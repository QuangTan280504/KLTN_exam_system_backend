import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
// import * as ExcelJS from 'exceljs'; // [CƠ CHẾ CŨ] export access codes
import { ExamSession } from "./entities/exam-session.entity";
import { Student } from "../student/entities/student.entity";
import { StudentExam } from "../student-exam/entities/student-exam.entity";
import { CreateExamSessionDto } from "./dto/create-exam-session.dto";
import { UpdateExamSessionDto } from "./dto/update-exam-session.dto";
import { StudentExamStatus } from "../student-exam/enums/student-exam-status.enum";
import { SessionStatus } from "./enums/session-status.enum";

/**
 * Trích khối (grade level) từ tên lớp.
 * Ví dụ: "10A1" → "10", "11B2" → "11", "9C" → "9"
 * Nếu không parse được thì trả về null.
 */
function extractGradeLevel(className: string | null | undefined): string | null {
    if (!className) return null;
    const match = className.match(/^(\d+)/);
    return match ? match[1] : null;
}

@Injectable()
export class ExamSessionService {
    constructor(
        @InjectRepository(ExamSession)
        private sessionRepository: Repository<ExamSession>,
        @InjectRepository(Student)
        private studentRepository: Repository<Student>,
        @InjectRepository(StudentExam)
        private studentExamRepository: Repository<StudentExam>,
    ) {}

    async create(createDto: CreateExamSessionDto, userId?: string): Promise<ExamSession> {
        const session = this.sessionRepository.create({
            ...createDto,
            ...(userId ? { createdById: userId } : {}),
        });
        return await this.sessionRepository.save(session);
    }

    async findAll(): Promise<ExamSession[]> {
        const sessions = await this.sessionRepository.find({
            relations: {
                matrix: {
                    subject: true,
                },
                createdBy: true,
            },
            order: { startTime: "DESC" },
        });
        // Sanitize: don't leak password
        sessions.forEach((s) => {
            if (s.createdBy) {
                delete (s.createdBy as any).password;
            }
        });
        return sessions;
    }

    async findOne(id: string): Promise<ExamSession> {
        const session = await this.sessionRepository.findOne({
            where: { id },
            relations: {
                matrix: {
                    subject: true,
                },
                createdBy: true,
            },
        });
        if (!session) {
            throw new NotFoundException(`Exam Session with ID ${id} not found`);
        }
        // Sanitize: don't leak password
        if (session.createdBy) {
            delete (session.createdBy as any).password;
        }
        return session;
    }

    async update(id: string, updateDto: UpdateExamSessionDto): Promise<ExamSession> {
        const session = await this.findOne(id);

        // Validation: If session is not DRAFT, restrict updates
        if (session.status !== SessionStatus.DRAFT) {
            // Critical fields cannot be changed once session is active/completed
            if (updateDto.matrixId && updateDto.matrixId !== session.matrixId) {
                throw new BadRequestException("Không thể thay đổi đề thi khi ca thi đã được kích hoạt");
            }
            // Note: Compare timestamps safely
            if (updateDto.startTime) {
                const newStart = new Date(updateDto.startTime).getTime();
                const oldStart = session.startTime.getTime();
                if (newStart !== oldStart) {
                    throw new BadRequestException("Không thể thay đổi thời gian khi ca thi đã được kích hoạt");
                }
            }
        }

        // Auto-assign: khi chuyển từ DRAFT → ACTIVE, tự động gán HS theo className
        const isPublishing = session.status === SessionStatus.DRAFT && updateDto.status === SessionStatus.ACTIVE;

        Object.assign(session, updateDto);
        const saved = await this.sessionRepository.save(session);

        if (isPublishing) {
            await this.autoAssignStudents(saved);
        }

        return saved;
    }

    /**
     * Tự động tạo StudentExam cho tất cả HS cùng className khi publish ca thi.
     * Bỏ qua HS đã có StudentExam trong session (tránh duplicate).
     */
    async autoAssignStudents(session: ExamSession): Promise<{ assigned: number; skipped: number }> {
        if (!session.className) {
            return { assigned: 0, skipped: 0 };
        }

        // Tìm tất cả HS thuộc lớp
        const students = await this.studentRepository.find({
            where: { className: session.className },
        });

        let assigned = 0;
        let skipped = 0;

        for (const student of students) {
            // Kiểm tra đã có StudentExam chưa
            const existing = await this.studentExamRepository.findOne({
                where: { sessionId: session.id, studentId: student.id },
            });

            if (existing) {
                skipped++;
                continue;
            }

            const studentExam = this.studentExamRepository.create({
                sessionId: session.id,
                studentId: student.id,
                accessCode: null, // Không dùng access code nữa
                status: StudentExamStatus.REGISTERED,
            });

            await this.studentExamRepository.save(studentExam);
            assigned++;
        }

        return { assigned, skipped };
    }

    async remove(id: string): Promise<void> {
        const session = await this.findOne(id);

        if (session.status !== SessionStatus.DRAFT) {
            throw new BadRequestException("Chỉ có thể xóa ca thi ở trạng thái Nháp");
        }

        await this.sessionRepository.remove(session);
    }

    // [CƠ CHẾ CŨ] Không còn dùng access code
    // generateAccessCode(): string {
    //     return Math.random().toString(36).substring(2, 12).toUpperCase();
    // }

    async getStudentsInSession(sessionId: string): Promise<any[]> {
        // Lấy StudentExam records nếu đã có (sau khi publish)
        const studentExams = await this.studentExamRepository.find({
            where: { sessionId },
            relations: ["student"],
            order: { student: { studentCode: "ASC" } },
        });

        if (studentExams.length > 0) {
            return studentExams;
        }

        // Nếu chưa có StudentExam (DRAFT hoặc chưa auto-assign) nhưng có className
        // → trả về danh sách HS lớp đó dạng preview
        const session = await this.sessionRepository.findOne({ where: { id: sessionId } });
        if (session?.className) {
            const classStudents = await this.studentRepository.find({
                where: { className: session.className },
                order: { studentCode: "ASC" },
            });

            return classStudents.map((student) => ({
                id: null,
                studentId: student.id,
                sessionId: sessionId,
                accessCode: null,
                status: "NOT_ASSIGNED",
                score: null,
                student: student,
            }));
        }

        return [];
    }

    /**
     * Lấy danh sách ca thi tương đương, lọc theo cùng khối (grade level).
     * Ví dụ: HS lớp 10A1 chỉ thấy ca thi của khối 10 (10A2, 10B1...), không thấy khối 11.
     *
     * Chia 2 mức ưu tiên:
     *  1. sameMatrix: cùng ma trận đề + cùng khối
     *  2. sameSubjectDiffMatrix: cùng môn học + cùng khối nhưng khác ma trận đề
     */
    async getEquivalentSessions(sessionId: string) {
        const session = await this.findOne(sessionId);
        const subjectId = session.matrix?.subjectId;
        const sessionGrade = extractGradeLevel(session.className);

        // Tìm tất cả session chưa FINISHED, kèm matrix & subject
        const allSessions = await this.sessionRepository.find({
            relations: { matrix: { subject: true } },
            order: { startTime: "ASC" },
        });

        const sameMatrix: any[] = [];
        const sameSubjectDiffMatrix: any[] = [];

        for (const s of allSessions) {
            if (s.id === sessionId) continue;
            if (s.status === SessionStatus.FINISHED) continue;

            // Kiểm tra cùng khối — bắt buộc
            const targetGrade = extractGradeLevel(s.className);
            if (sessionGrade && targetGrade && sessionGrade !== targetGrade) continue;

            const isSameMatrix = s.matrixId === session.matrixId;
            const isSameSubject = subjectId && s.matrix?.subjectId === subjectId;

            if (!isSameMatrix && !isSameSubject) continue;

            const item = {
                id: s.id,
                name: s.name,
                className: s.className,
                matrixName: s.matrix?.name || null,
                subjectName: s.matrix?.subject?.name || null,
                startTime: s.startTime,
                endTime: s.endTime,
                status: s.status,
            };

            if (isSameMatrix) {
                sameMatrix.push(item);
            } else {
                sameSubjectDiffMatrix.push(item);
            }
        }

        return { sameMatrix, sameSubjectDiffMatrix, gradeLevel: sessionGrade };
    }

    /**
     * Chuyển HS vắng thi sang ca thi khác tương đương.
     * Giáo viên thực hiện thao tác này từ trang chi tiết ca thi.
     */
    async transferStudent(targetSessionId: string, studentExamId: string) {
        // 1. Kiểm tra StudentExam cũ
        const oldStudentExam = await this.studentExamRepository.findOne({
            where: { id: studentExamId },
            relations: ["session", "session.matrix", "student"],
        });
        if (!oldStudentExam) {
            throw new NotFoundException("Không tìm thấy bản ghi StudentExam");
        }
        if (oldStudentExam.status !== StudentExamStatus.ABSENT) {
            throw new BadRequestException("Chỉ có thể chuyển ca thi cho học sinh có trạng thái Vắng thi");
        }

        // 2. Kiểm tra session đích
        const targetSession = await this.findOne(targetSessionId);
        if (targetSession.status === SessionStatus.FINISHED) {
            throw new BadRequestException("Ca thi đích đã kết thúc, không thể chuyển");
        }

        // 3. Kiểm tra tương đương (cùng matrixId hoặc cùng subjectId)
        const oldSubjectId = oldStudentExam.session?.matrix?.subjectId;
        const targetSubjectId = targetSession.matrix?.subjectId;
        const isSameMatrix = oldStudentExam.session.matrixId === targetSession.matrixId;
        const isSameSubject = oldSubjectId && targetSubjectId && oldSubjectId === targetSubjectId;

        if (!isSameMatrix && !isSameSubject) {
            throw new BadRequestException("Ca thi đích không tương đương (khác môn học và khác ma trận đề)");
        }

        // 4. Kiểm tra cùng khối (grade level) — 10A1 ↔ 10A2 OK, 10A1 ↔ 11A1 KHÔNG
        const oldGrade = extractGradeLevel(oldStudentExam.session?.className);
        const targetGrade = extractGradeLevel(targetSession.className);
        if (oldGrade && targetGrade && oldGrade !== targetGrade) {
            throw new BadRequestException(`Không thể chuyển khác khối: khối ${oldGrade} → khối ${targetGrade}`);
        }

        // 5. Kiểm tra HS chưa có trong session đích
        const existing = await this.studentExamRepository.findOne({
            where: { sessionId: targetSessionId, studentId: oldStudentExam.studentId },
        });
        if (existing) {
            throw new BadRequestException("Học sinh đã có trong ca thi đích");
        }

        // 6. Tạo StudentExam mới ở session đích
        const newStudentExam = this.studentExamRepository.create({
            sessionId: targetSessionId,
            studentId: oldStudentExam.studentId,
            accessCode: null,
            status: StudentExamStatus.REGISTERED,
        });
        await this.studentExamRepository.save(newStudentExam);

        // 7. Giữ nguyên bản ghi cũ (ABSENT) — không xóa, để có lịch sử

        return {
            message: `Đã chuyển ${oldStudentExam.student?.fullName || "HS"} sang ca thi "${targetSession.name}"`,
            newStudentExamId: newStudentExam.id,
            studentName: oldStudentExam.student?.fullName,
            targetSessionName: targetSession.name,
        };
    }

    // [CƠ CHẾ CŨ] Export access codes — không còn dùng
    // async exportAccessCodes(sessionId: string): Promise<Buffer> {
    //     const students = await this.getStudentsInSession(sessionId);
    //     const session = await this.findOne(sessionId);
    //
    //     const workbook = new ExcelJS.Workbook();
    //     const sheet = workbook.addWorksheet('Access Codes');
    //
    //     sheet.columns = [
    //         { header: 'Mã SV', key: 'code', width: 15 },
    //         { header: 'Họ và tên', key: 'name', width: 25 },
    //         { header: 'Lớp', key: 'class', width: 15 },
    //         { header: 'Mã truy cập', key: 'accessCode', width: 20 },
    //         { header: 'Trạng thái', key: 'status', width: 15 },
    //     ];
    //
    //     sheet.getRow(1).font = { bold: true };
    //     sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
    //
    //     students.forEach(s => {
    //         sheet.addRow({
    //             code: s.student.studentCode,
    //             name: s.student.fullName,
    //             class: s.student.className,
    //             accessCode: s.accessCode,
    //             status: s.status,
    //         });
    //     });
    //
    //     const infoSheet = workbook.addWorksheet('Info');
    //     infoSheet.addRow(['Ca thi:', session.name]);
    //     infoSheet.addRow(['Thời gian:', session.startTime]);
    //
    //     return await workbook.xlsx.writeBuffer() as any as Buffer;
    // }
}
