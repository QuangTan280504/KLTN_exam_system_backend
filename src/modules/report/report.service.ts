import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import * as ExcelJS from "exceljs";
import { Repository } from "typeorm";
import { Question } from "../question/entities/question.entity";
import { GroupData, MCQData, ShortAnswerData } from "../question/interfaces/question-data.interface";
import { StudentExam } from "../student-exam/entities/student-exam.entity";
import { ExamSnapshot } from "../student-exam/interfaces/exam-snapshot.interface";

import { ExamSession } from "../exam-session/entities/exam-session.entity";
import { Student } from "../student/entities/student.entity";
import { Subject } from "../subject/entities/subject.entity";

@Injectable()
export class ReportService {
    constructor(
        @InjectRepository(StudentExam)
        private studentExamRepository: Repository<StudentExam>,
        @InjectRepository(Question)
        private questionRepository: Repository<Question>,
        @InjectRepository(Subject)
        private subjectRepository: Repository<Subject>,
        @InjectRepository(ExamSession)
        private examSessionRepository: Repository<ExamSession>,
        @InjectRepository(Student)
        private studentRepository: Repository<Student>,
    ) {}

    async getDashboardStats() {
        const [subjectsCount, questionsCount, activeSessionsCount, studentsCount] = await Promise.all([this.subjectRepository.count(), this.questionRepository.count(), this.examSessionRepository.count({ where: { status: "ACTIVE" as any } }), this.studentRepository.count()]);

        return {
            subjectsCount,
            questionsCount,
            activeSessionsCount,
            studentsCount,
        };
    }

    private formatDate(date: Date | string): string {
        if (!date) return "";
        const d = new Date(date);
        return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear()}`;
    }

    private sanitizeFileName(name: string): string {
        return name.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    }

    async exportScoreSheet(sessionId: string): Promise<{ buffer: Buffer; fileName: string }> {
        const session = await this.examSessionRepository.findOne({
            where: { id: sessionId },
        });

        if (!session) {
            throw new NotFoundException("Session not found");
        }

        const studentExams = await this.studentExamRepository.find({
            where: { sessionId },
            relations: ["student"],
            order: { student: { studentCode: "ASC" } },
        });

        if (studentExams.length === 0) {
            throw new NotFoundException("No students found for this session");
        }

        // Determine totals from the first available snapshot
        let totalMCQ = 0;
        let totalGroupSub = 0;
        let totalShortAnswer = 0;
        const examWithSnapshot = studentExams.find((se) => se.examSnapshot);
        if (examWithSnapshot && examWithSnapshot.examSnapshot) {
            const snapshot = examWithSnapshot.examSnapshot as ExamSnapshot;
            totalMCQ = snapshot.part1_mcq?.length || 0;
            totalGroupSub = (snapshot.part2_group || []).reduce((sum, q) => sum + (q.sub_questions?.length || 0), 0);
            totalShortAnswer = snapshot.part3_short_answer?.length || 0;
        }

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet("TongHop");

        // Set column headers
        sheet.columns = [
            { header: "STT", key: "stt", width: 5 },
            { header: "SBD", key: "code", width: 15 },
            { header: "Họ và tên", key: "name", width: 30 },
            { header: "Ngày sinh", key: "dob", width: 15, style: { alignment: { horizontal: "center" } } },
            { header: "Lớp", key: "class", width: 10, style: { alignment: { horizontal: "center" } } },
            // [CƠ CHẾ CŨ] { header: 'Mã đăng nhập', key: 'accessCode', width: 15 },
            { header: "Số câu P.I", key: "mcq", width: 12, style: { alignment: { horizontal: "center" } } },
            { header: "Số ý P.II", key: "group", width: 12, style: { alignment: { horizontal: "center" } } },
            { header: "P.III", key: "shortAnswer", width: 14, style: { alignment: { horizontal: "center" } } },
            { header: "Tổng điểm", key: "score", width: 12, style: { font: { bold: true }, alignment: { horizontal: "center" } } },
            { header: "Học sinh ký", key: "signature", width: 20 },
        ];

        // Style header row
        sheet.getRow(1).font = { bold: true, size: 11 };
        sheet.getRow(1).alignment = { horizontal: "center", vertical: "middle" };

        // Add data rows
        studentExams.forEach((se, idx) => {
            const scoreDisplay = se.score != null ? Number(se.score).toFixed(2) : "0.00";
            const mcqDisplay = se.mcqCorrectCount != null ? `${se.mcqCorrectCount}/${totalMCQ}` : "";
            const groupDisplay = se.groupCorrectCount != null ? `${se.groupCorrectCount}/${totalGroupSub}` : "";

            // Part 3: count answered short answer questions
            let shortAnswerDisplay = "";
            if (totalShortAnswer > 0 && se.studentAnswers) {
                const answeredCount = (se.studentAnswers.short_answers || []).filter((a: any) => a.answer_text && a.answer_text.trim() !== "").length;
                shortAnswerDisplay = `${answeredCount}/${totalShortAnswer}`;
            }

            sheet.addRow({
                stt: idx + 1,
                code: se.student.studentCode,
                name: se.student.fullName,
                dob: this.formatDate(se.student.dateOfBirth),
                class: se.student.className || "",
                // [CƠ CHẾ CŨ] accessCode: se.accessCode,
                mcq: mcqDisplay,
                group: groupDisplay,
                shortAnswer: shortAnswerDisplay,
                score: scoreDisplay,
                signature: "",
            });
        });

        // Add Footer Signatures
        sheet.addRow([]);
        sheet.addRow([]);
        sheet.addRow([]);
        sheet.addRow([]); // Spacing

        const dateRow = sheet.addRow(["", "", "", "", `......., ngày ${new Date().getDate()} tháng ${new Date().getMonth() + 1} năm ${new Date().getFullYear()}`]);
        dateRow.font = { italic: true };
        dateRow.alignment = { horizontal: "center" };
        sheet.mergeCells(`E${dateRow.number}:I${dateRow.number}`);

        sheet.addRow([]);

        const signTitleRow = sheet.addRow(["", "GIÁM THỊ 1", "", "", "GIÁM THỊ 2"]);
        signTitleRow.font = { bold: true };
        signTitleRow.alignment = { horizontal: "center" };
        sheet.mergeCells(`B${signTitleRow.number}:D${signTitleRow.number}`);
        sheet.mergeCells(`E${signTitleRow.number}:I${signTitleRow.number}`);

        const signNoteRow = sheet.addRow(["", "(Ký, ghi rõ họ tên)", "", "", "(Ký, ghi rõ họ tên)"]);
        signNoteRow.font = { italic: true };
        signNoteRow.alignment = { horizontal: "center" };
        sheet.mergeCells(`B${signNoteRow.number}:D${signNoteRow.number}`);
        sheet.mergeCells(`E${signNoteRow.number}:I${signNoteRow.number}`);

        // Borders for data table
        const lastRow = studentExams.length + 1;
        for (let r = 1; r <= lastRow; r++) {
            const row = sheet.getRow(r);
            row.eachCell((cell) => {
                cell.border = {
                    top: { style: "thin" },
                    left: { style: "thin" },
                    bottom: { style: "thin" },
                    right: { style: "thin" },
                };
            });
        }

        const buffer = (await workbook.xlsx.writeBuffer()) as any;
        const safeDate = this.formatDate(new Date()).replace(/\//g, "-");
        const fileName = `KetQua_${this.sanitizeFileName(session.name)}_${safeDate}.xlsx`;

        return { buffer, fileName };
    }

    async exportAuditLog(sessionId: string): Promise<{ buffer: Buffer; fileName: string }> {
        const session = await this.examSessionRepository.findOne({
            where: { id: sessionId },
        });

        if (!session) {
            throw new NotFoundException("Session not found");
        }

        const studentExams = await this.studentExamRepository.find({
            where: { sessionId },
            relations: ["student"],
            order: { student: { studentCode: "ASC" } },
        });

        if (studentExams.length === 0) {
            throw new NotFoundException("No students found for this session");
        }

        // Get exam structure from first student with snapshot
        const firstExam = studentExams.find((se) => se.examSnapshot);
        if (!firstExam || !firstExam.examSnapshot) {
            throw new NotFoundException("No exam data found");
        }

        const snapshot = firstExam.examSnapshot as ExamSnapshot;
        const mcqCount = snapshot.part1_mcq.length;
        const groupCount = snapshot.part2_group.length;
        const shortAnswerCount = snapshot.part3_short_answer?.length || 0;

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet("ChiTiet");

        // Build dynamic headers
        const headers = ["STT", "SBD", "Họ tên"];

        // MCQ headers
        for (let i = 1; i <= mcqCount; i++) {
            headers.push(`Câu ${i}`);
        }

        // Group headers
        const groupStartIndex = headers.length;
        for (let i = 1; i <= groupCount; i++) {
            headers.push(`Câu ${mcqCount + i}`);
        }

        // Short Answer headers
        for (let i = 1; i <= shortAnswerCount; i++) {
            headers.push(`Câu ${mcqCount + groupCount + i} (TL)`);
        }

        const headerRow = sheet.addRow(headers);
        headerRow.font = { bold: true };
        headerRow.alignment = { horizontal: "center", vertical: "middle" };

        // Process each student
        for (const [idx, se] of studentExams.entries()) {
            const row = [idx + 1, se.student.studentCode, se.student.fullName];

            if (!se.examSnapshot || !se.studentAnswers) {
                // Empty cells if no exam data
                for (let i = 0; i < mcqCount + groupCount + shortAnswerCount; i++) {
                    row.push("");
                }
                sheet.addRow(row);
                continue;
            }

            const snapshot = se.examSnapshot as ExamSnapshot;
            const answers = se.studentAnswers;

            // Get original questions for verification (Correct/Wrong check)
            const originalQuestionIds = [...snapshot.part1_mcq.map((q) => q.original_question_id), ...snapshot.part2_group.map((q) => q.original_question_id), ...(snapshot.part3_short_answer || []).map((q) => q.original_question_id)];
            const originalQuestions = await this.questionRepository.findByIds(originalQuestionIds);
            const questionMap = new Map(originalQuestions.map((q) => [q.id, q]));

            // --- Process MCQ ---
            for (const snapshotQ of snapshot.part1_mcq) {
                const answer = answers.mcq_answers?.find((a) => a.question_id === snapshotQ.question_id);
                const originalQ = questionMap.get(snapshotQ.original_question_id);

                if (!answer || !originalQ) {
                    row.push("");
                    continue;
                }

                // Format: Label (Result) e.g. "A (Đúng)"
                const selectedOption = snapshotQ.options.find((o) => o.id === answer.selected_option_id);
                const label = selectedOption?.display_label || "?";
                const originalData = originalQ?.data as MCQData;
                const isCorrect = answer.selected_option_id === originalData?.correct_option_id;

                row.push(`${label} (${isCorrect ? "Đúng" : "Sai"})`);
            }

            // --- Process Group ---
            for (const snapshotQ of snapshot.part2_group) {
                const answer = answers.group_answers?.find((a) => a.question_id === snapshotQ.question_id);
                const originalQ = questionMap.get(snapshotQ.original_question_id);

                if (!answer || !originalQ) {
                    row.push("");
                    continue;
                }

                const originalData = originalQ.data as GroupData;
                const subResults: string[] = [];

                // Format: a:Đ(Đ)-b:S(S)...
                for (const snapshotSub of snapshotQ.sub_questions) {
                    const subAnswer = answer.sub_answers?.find((sa) => sa.sub_question_id === snapshotSub.id);
                    const originalSub = originalData?.sub_questions?.find((s) => s.id === snapshotSub.id);

                    if (!subAnswer || !originalSub) {
                        subResults.push(`${snapshotSub.display_label}:?(?)`);
                        continue;
                    }

                    const isCorrect = subAnswer.selected === originalSub?.is_correct;
                    const selectedText = subAnswer.selected ? "Đ" : "S"; // HS chọn Đ/S
                    const resultText = isCorrect ? "Đ" : "S"; // Kết quả Đ/S (theo ví dụ user: a:Đ(Đ) -> chọn Đ và đúng)
                    // Wait, user example: "a:Đ(Đ) nghĩa là HS chọn Đúng và máy chấm là Chính xác" -> Result is Correctness?
                    // "a:Đ(S) nghĩa là HS chọn Đúng nhưng máy chấm là Sai" -> Result is Correctness?
                    // User Example: a:Đ(S) -> HS selected Đ, Result is S (Wrong). So inner parens is correct/wrong status?
                    // Re-read: "b:S(S)" -> HS selected S, result is S (Wrong)? Or result is Matches Key?
                    // Usually (Đ) means Correct, (S) means Wrong.
                    // Let's assume (Đ) = Correct, (S) = Wrong.

                    subResults.push(`${snapshotSub.display_label}:${selectedText}(${isCorrect ? "Đ" : "S"})`);
                }
                row.push(subResults.join("-"));
            }

            // --- Process Short Answer ---
            if (snapshot.part3_short_answer) {
                for (const snapshotQ of snapshot.part3_short_answer) {
                    const answer = answers.short_answers?.find((a) => a.question_id === snapshotQ.question_id);

                    if (!answer || !answer.answer_text || answer.answer_text.trim() === "") {
                        row.push("(Chưa trả lời)");
                        continue;
                    }

                    // Truncate long answers for the audit log cell
                    const text = answer.answer_text.trim();
                    row.push(text.length > 100 ? text.substring(0, 97) + "..." : text);
                }
            }

            sheet.addRow(row);
        }

        // Add Footer
        sheet.addRow([]);
        sheet.addRow([]);

        const signTitleRow = sheet.addRow(["", "GIÁM THỊ 1", "", "", "", "GIÁM THỊ 2"]);
        signTitleRow.font = { bold: true };
        signTitleRow.alignment = { horizontal: "center" };
        // Merging for signatures might be tricky without knowing column count.
        // Approximate merging

        // Auto-width
        sheet.columns.forEach((col) => {
            if (!col.width) col.width = 15;
        });

        const buffer = (await workbook.xlsx.writeBuffer()) as any;
        const safeDate = this.formatDate(new Date()).replace(/\//g, "-");
        const fileName = `ChiTiet_${this.sanitizeFileName(session.name)}_${safeDate}.xlsx`;

        return { buffer, fileName };
    }
    async getStudentExamDetail(studentExamId: string) {
        const studentExam = await this.studentExamRepository.findOne({
            where: { id: studentExamId },
            relations: ["student", "session"],
        });

        if (!studentExam) {
            throw new NotFoundException("Student exam not found");
        }

        if (!studentExam.examSnapshot) {
            return {
                info: {
                    studentName: studentExam.student.fullName,
                    studentCode: studentExam.student.studentCode,
                    score: 0,
                    status: studentExam.status,
                },
                questions: [],
            };
        }

        const snapshot = studentExam.examSnapshot as ExamSnapshot;
        const answers = studentExam.studentAnswers || { mcq_answers: [], group_answers: [], short_answers: [] };

        // Get original questions
        const originalQuestionIds = [...snapshot.part1_mcq.map((q) => q.original_question_id), ...snapshot.part2_group.map((q) => q.original_question_id), ...(snapshot.part3_short_answer || []).map((q) => q.original_question_id)];

        const originalQuestions = await this.questionRepository.findByIds(originalQuestionIds);
        const questionMap = new Map(originalQuestions.map((q) => [q.id, q]));

        const processedQuestions = [];

        // Part 1: MCQ
        snapshot.part1_mcq.forEach((q, index) => {
            const originalQ = questionMap.get(q.original_question_id);
            const originalData = originalQ?.data as MCQData;
            const userAnswer = answers.mcq_answers?.find((a) => a.question_id === q.question_id);

            processedQuestions.push({
                index: index + 1,
                id: q.question_id,
                type: "MCQ",
                content: q.content, // Snapshot content (might be shuffled if we supported that, but usually text is same)
                images: q.images || [],
                options: q.options.map((opt) => ({
                    id: opt.id,
                    label: opt.display_label,
                    text: opt.text,
                    isSelected: userAnswer?.selected_option_id === opt.id,
                    isCorrect: originalData?.correct_option_id === opt.id,
                })),
                isCorrect: userAnswer?.selected_option_id === originalData?.correct_option_id,
                score: 0.25, // Standard score per MCQ
                cognitiveLevel: originalQ?.cognitiveLevel,
            });
        });

        // Part 2: Group
        const startIdx = snapshot.part1_mcq.length;
        snapshot.part2_group.forEach((q, index) => {
            const originalQ = questionMap.get(q.original_question_id);
            const originalData = originalQ?.data as GroupData;
            const userAnswer = answers.group_answers?.find((a) => a.question_id === q.question_id);

            processedQuestions.push({
                index: startIdx + index + 1,
                id: q.question_id,
                type: "GROUP",
                content: q.content,
                images: q.images || [],
                subQuestions: q.sub_questions.map((sub) => {
                    const originalSub = originalData?.sub_questions?.find((s) => s.id === sub.id);
                    const subAnswer = userAnswer?.sub_answers?.find((sa) => sa.sub_question_id === sub.id);

                    return {
                        id: sub.id,
                        label: sub.display_label,
                        content: sub.text,
                        userSelected: subAnswer?.selected, // true/false or undefined
                        isCorrectAnswer: originalSub?.is_correct, // true/false
                        isUserCorrect: subAnswer?.selected === originalSub?.is_correct,
                        cognitiveLevel: originalQ?.cognitiveLevel,
                    };
                }),
            });
        });

        // Part 3: Short Answer
        const part3StartIdx = startIdx + snapshot.part2_group.length;
        if (snapshot.part3_short_answer) {
            snapshot.part3_short_answer.forEach((q, index) => {
                const originalQ = questionMap.get(q.original_question_id);
                const originalData = originalQ?.data as ShortAnswerData;
                const userAnswer = answers.short_answers?.find((a) => a.question_id === q.question_id);

                processedQuestions.push({
                    index: part3StartIdx + index + 1,
                    id: q.question_id,
                    type: "SHORT_ANSWER",
                    content: q.content,
                    images: q.images || [],
                    studentAnswer: userAnswer?.answer_text || "",
                    sampleAnswer: originalData?.sample_answer || "",
                    cognitiveLevel: originalQ?.cognitiveLevel,
                });
            });
        }

        return {
            info: {
                studentName: studentExam.student.fullName,
                studentCode: studentExam.student.studentCode,
                className: studentExam.student.className,
                dayOfBirth: this.formatDate(studentExam.student.dateOfBirth),
                score: studentExam.score,
                status: studentExam.status,
                submittedAt: studentExam.submittedAt,
            },
            questions: processedQuestions,
        };
    }

    async exportStudentExamDetail(studentExamId: string): Promise<{ buffer: Buffer; fileName: string }> {
        const detail = await this.getStudentExamDetail(studentExamId);

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet("BaiLamChiTiet");

        // Header Info
        sheet.addRow(["CHI TIẾT BÀI LÀM"]).font = { bold: true, size: 14 };
        sheet.addRow([`Họ tên: ${detail.info.studentName} - SBD: ${detail.info.studentCode}`]);
        sheet.addRow([`Lớp: ${detail.info.className || ""} - Ngày sinh: ${detail.info.dayOfBirth}`]);
        sheet.addRow([`Điểm số: ${detail.info.score != null ? Number(detail.info.score).toFixed(2) : "0.00"}`]);
        sheet.addRow([]);

        // Questions
        detail.questions.forEach((q) => {
            if (q.type === "MCQ") {
                const row = sheet.addRow([`Câu ${q.index}: ${q.content}`]);
                row.font = { bold: true };

                const levelText = q.cognitiveLevel === 1 ? "Biết" : q.cognitiveLevel === 2 ? "Hiểu" : "Vận dụng";
                sheet.addRow([`   [Mức độ: ${levelText}]`]).font = { italic: true, size: 10 };

                q.options.forEach((opt) => {
                    let prefix = `   ${opt.label}. `;
                    if (opt.isSelected) prefix = `[x] ${opt.label}. `;

                    const optionRow = sheet.addRow([`${prefix}${opt.text}`]);
                    if (opt.isCorrect && opt.isSelected)
                        optionRow.font = { color: { argb: "FF008000" } }; // Green
                    else if (opt.isSelected && !opt.isCorrect) optionRow.font = { color: { argb: "FFFF0000" } }; // Red
                });

                const anySelected = q.options.some((opt) => opt.isSelected);
                if (!anySelected) {
                    const warnRow = sheet.addRow(["   (Thí sinh chưa chọn đáp án)"]);
                    warnRow.font = { italic: true, color: { argb: "FFFF0000" } };
                    sheet.addRow([`   -> Kết quả: SAI`]);
                } else {
                    sheet.addRow([`   -> Kết quả: ${q.isCorrect ? "ĐÚNG" : "SAI"}`]);
                }
            } else if (q.type === "GROUP") {
                const row = sheet.addRow([`Câu ${q.index} (Chùm): ${q.content}`]);
                row.font = { bold: true };

                const levelText = q.cognitiveLevel === 1 ? "Biết" : q.cognitiveLevel === 2 ? "Hiểu" : "Vận dụng";
                sheet.addRow([`   [Mức độ: ${levelText}]`]).font = { italic: true, size: 10 };

                q.subQuestions.forEach((sub) => {
                    const status = sub.isUserCorrect ? "ĐÚNG" : "SAI";
                    const userChoice = sub.userSelected === true ? "Đúng" : sub.userSelected === false ? "Sai" : "Chưa chọn";
                    const correctChoice = sub.isCorrectAnswer ? "Đúng" : "Sai";

                    sheet.addRow([`   ${sub.label}) ${sub.content}`]);
                    sheet.addRow([`      Chọn: ${userChoice} | Đáp án: ${correctChoice} -> ${status}`]);
                });
            } else if (q.type === "SHORT_ANSWER") {
                const row = sheet.addRow([`Câu ${q.index} (Trả lời ngắn): ${q.content}`]);
                row.font = { bold: true };

                const levelText = q.cognitiveLevel === 1 ? "Biết" : q.cognitiveLevel === 2 ? "Hiểu" : "Vận dụng";
                sheet.addRow([`   [Mức độ: ${levelText}]`]).font = { italic: true, size: 10 };

                sheet.addRow([`   Bài làm của thí sinh:`]);
                const answerRow = sheet.addRow([`   ${q.studentAnswer || "(Chưa trả lời)"}`]);
                answerRow.font = { color: { argb: "FF0000FF" } }; // Blue

                if (q.sampleAnswer) {
                    sheet.addRow([`   Đáp án mẫu:`]).font = { italic: true };
                    sheet.addRow([`   ${q.sampleAnswer}`]).font = { italic: true, color: { argb: "FF008000" } }; // Green
                }
            }
            sheet.addRow([]);
        });

        // Auto width for A column mainly
        sheet.getColumn(1).width = 80;
        sheet.getColumn(1).alignment = { wrapText: true };

        const buffer = (await workbook.xlsx.writeBuffer()) as any;
        const fileName = `BaiLam_${this.sanitizeFileName(detail.info.studentName)}_${detail.info.studentCode}.xlsx`;

        return { buffer, fileName };
    }
}
