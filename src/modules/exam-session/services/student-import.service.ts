import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import * as crypto from 'crypto';
import { Student } from '../../student/entities/student.entity';
import { StudentExam } from '../../student-exam/entities/student-exam.entity';
import { StudentExamStatus } from '../../student-exam/enums/student-exam-status.enum';
import { ExamSession } from '../entities/exam-session.entity';
import {
    ImportResult,
    StudentData,
} from '../interfaces/student-import.interface';

@Injectable()
export class StudentImportService {
    constructor(
        @InjectRepository(Student)
        private studentRepository: Repository<Student>,
        @InjectRepository(StudentExam)
        private studentExamRepository: Repository<StudentExam>,
        @InjectRepository(ExamSession)
        private sessionRepository: Repository<ExamSession>,
    ) { }

    async importFromExcel(
        sessionId: string,
        buffer: Buffer,
    ): Promise<{
        total: number;
        successCount: number;
        duplicateCount: number;
        errorCount: number;
        results: ImportResult[];
    }> {
        const studentsData = await this.parseExcel(buffer);
        const results: ImportResult[] = [];
        let successCount = 0;
        let duplicateCount = 0;
        let errorCount = 0;

        const targetSession = await this.sessionRepository.findOne({ where: { id: sessionId } });
        if (!targetSession) {
            throw new BadRequestException('Exam Session not found');
        }

        for (const data of studentsData) {
            try {
                // 1. Find or Create Student
                let student = await this.studentRepository.findOne({
                    where: { studentCode: data.code },
                });

                if (student) {
                    // Update info if exists
                    student.fullName = data.fullName;
                    student.className = data.className;
                    if (data.dateOfBirth) student.dateOfBirth = data.dateOfBirth;
                    await this.studentRepository.save(student);
                } else {
                    student = this.studentRepository.create({
                        studentCode: data.code,
                        fullName: data.fullName,
                        className: data.className,
                        dateOfBirth: data.dateOfBirth,
                    });
                    await this.studentRepository.save(student);
                }

                // 2. Check if already in session
                const existingExam = await this.studentExamRepository.findOne({
                    where: { sessionId, studentId: student.id },
                });

                if (existingExam) {
                    duplicateCount++;
                    results.push({ student, status: 'DUPLICATE', message: 'Already registered' });
                    continue;
                }

                // 2.5 Check time overlap with other sessions
                const overlappingExam = await this.checkSessionOverlap(student.id, targetSession);
                if (overlappingExam) {
                    errorCount++;
                    results.push({
                        student,
                        status: 'ERROR',
                        message: `Conflict with session "${overlappingExam.session.name}"`
                    });
                    continue;
                }

                // 3. Register for session
                const accessCode = await this.generateUniqueAccessCode();
                const studentExam = this.studentExamRepository.create({
                    sessionId,
                    studentId: student.id,
                    accessCode,
                    status: StudentExamStatus.REGISTERED,
                });

                await this.studentExamRepository.save(studentExam);
                successCount++;
                results.push({ student, status: 'SUCCESS' });
            } catch (error) {
                errorCount++;
                console.error('Import error for student:', data.code, error);
                results.push({
                    student: { studentCode: data.code } as any,
                    status: 'ERROR',
                    message: error.message
                });
            }
        }

        return {
            total: studentsData.length,
            successCount,
            duplicateCount,
            errorCount,
            results
        };
    }

    private async generateUniqueAccessCode(): Promise<string> {
        // Retry up to 5 times
        for (let i = 0; i < 5; i++) {
            const code = crypto.randomBytes(3).toString('hex').toUpperCase(); // 6 chars
            const exists = await this.studentExamRepository.findOne({
                where: { accessCode: code },
            });
            if (!exists) return code;
        }
        throw new Error('Failed to generate unique access code');
    }

    private async parseExcel(buffer: Buffer): Promise<StudentData[]> {
        const workbook = new ExcelJS.Workbook();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await workbook.xlsx.load(buffer as any);

        const sheet = workbook.worksheets[0]; // Use first sheet regardless of ID
        const students: StudentData[] = [];

        if (!sheet) {
            console.error('No sheet found in workbook');
            throw new BadRequestException('Excel file must have at least one sheet');
        }

        console.log(`Processing sheet: ${sheet.name}, Total rows: ${sheet.rowCount}`);

        sheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return; // Skip header

            // Handle various cell value types (string, number, object)
            const getCellValue = (colIndex: number) => {
                const cell = row.getCell(colIndex);
                if (cell.value && typeof cell.value === 'object' && 'text' in cell.value) {
                    return (cell.value as any).text; // Handle rich text
                }
                return cell.value ? cell.value.toString() : '';
            };

            const code = getCellValue(1).trim();
            const fullName = getCellValue(2).trim();
            const dobRaw = row.getCell(3).value;
            const className = getCellValue(4).trim();

            if (!code || !fullName) {
                console.warn(`Row ${rowNumber} skipped: Missing code or name`, { code, fullName });
                return; // Skip invalid rows
            }

            // ... (keep date parsing logic)
            let dateOfBirth: Date | undefined;
            if (dobRaw instanceof Date) {
                dateOfBirth = dobRaw;
            } else if (typeof dobRaw === 'string') {
                // Try parsing various date formats if possible
                try {
                    const parts = dobRaw.split('/');
                    if (parts.length === 3) {
                        dateOfBirth = new Date(
                            parseInt(parts[2]),
                            parseInt(parts[1]) - 1,
                            parseInt(parts[0])
                        );
                    } else {
                        // Fallback try simple date parse
                        const d = new Date(dobRaw);
                        if (!isNaN(d.getTime())) dateOfBirth = d;
                    }
                } catch (e) {
                    console.warn('Date parse error row', rowNumber, e);
                }
            }

            students.push({
                code,
                fullName,
                className: className || '',
                dateOfBirth,
            });
        });

        console.log(`Parsed ${students.length} students`);

        return students;
    }

    private async checkSessionOverlap(studentId: string, targetSession: ExamSession): Promise<StudentExam | null> {
        const studentExams = await this.studentExamRepository.find({
            where: { studentId },
            relations: ['session'],
        });

        // Current session time window
        const newStart = targetSession.startTime.getTime();
        const newEnd = targetSession.endTime.getTime();

        for (const exam of studentExams) {
            // Skip checks for finished or cancelled exams if needed (optional policy)
            // Here strict checking: if you are in a session, you are busy.

            const existingStart = exam.session.startTime.getTime();
            const existingEnd = exam.session.endTime.getTime();

            // Check overlap
            // (StartA <= EndB) and (EndA >= StartB)
            if (newStart <= existingEnd && newEnd >= existingStart) {
                return exam;
            }
        }

        return null;
    }
}
