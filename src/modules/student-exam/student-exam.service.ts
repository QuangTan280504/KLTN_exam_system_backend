import { Injectable, NotFoundException, BadRequestException, UnauthorizedException, ForbiddenException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { StudentExam } from "./entities/student-exam.entity";
import { ExamSnapshotService } from "./services/exam-snapshot.service";
import { GradingService } from "./services/grading.service";
import { StudentExamStatus } from "./enums/student-exam-status.enum";
import { ExamSnapshot, StudentAnswers } from "./interfaces/exam-snapshot.interface";

@Injectable()
export class StudentExamService {
    constructor(
        @InjectRepository(StudentExam)
        private studentExamRepository: Repository<StudentExam>,
        private snapshotService: ExamSnapshotService,
        private gradingService: GradingService,
    ) {}

    async startExam(studentExamId: string): Promise<ExamSnapshot> {
        const studentExam = await this.studentExamRepository.findOne({
            where: { id: studentExamId },
            relations: ["session", "session.matrix"],
        });

        if (!studentExam) {
            throw new NotFoundException("Student exam not found");
        }

        if (studentExam.status === StudentExamStatus.SUBMITTED) {
            throw new BadRequestException("Bài thi đã được nộp.");
        }

        // Check if it's too early to start
        const now = new Date();
        const startTime = new Date(studentExam.session.startTime);
        // Allow a 2-second buffer for minor clock differences
        if (now.getTime() < startTime.getTime() - 2000) {
            throw new BadRequestException("Ca thi chưa đến giờ bắt đầu.");
        }

        // If already has snapshot, return it (reconnect scenario)
        if (studentExam.examSnapshot) {
            return this.snapshotService.sanitizeForFrontend(studentExam.examSnapshot as ExamSnapshot);
        }

        // Generate new snapshot
        const snapshot = await this.snapshotService.generateSnapshot(studentExam.session.matrixId);

        studentExam.examSnapshot = snapshot;
        studentExam.startedAt = new Date();
        studentExam.status = StudentExamStatus.IN_PROGRESS;

        await this.studentExamRepository.save(studentExam);

        return this.snapshotService.sanitizeForFrontend(snapshot);
    }

    async submitExam(studentExamId: string, answers: StudentAnswers): Promise<any> {
        const studentExam = await this.studentExamRepository.findOne({
            where: { id: studentExamId },
            relations: ["session"],
        });

        if (!studentExam) {
            throw new NotFoundException("Student exam not found");
        }

        if (studentExam.status === StudentExamStatus.SUBMITTED) {
            throw new BadRequestException("Exam already submitted");
        }

        if (!studentExam.examSnapshot) {
            throw new BadRequestException("Exam not started");
        }

        // Check if submission is too late (allow 60 seconds grace period for network latency)
        // If session is AUTO-CLOSED by scheduler, we still accept if within grace period
        const now = new Date();
        const gracePeriod = 60 * 1000; // 60 seconds
        if (studentExam.session.endTime && now.getTime() > studentExam.session.endTime.getTime() + gracePeriod) {
            throw new BadRequestException("Đã quá thời gian nộp bài.");
        }

        // Grade the exam
        const gradingResult = await this.gradingService.gradeExam(studentExam.examSnapshot as ExamSnapshot, answers);

        // Save results
        studentExam.studentAnswers = answers;
        studentExam.score = gradingResult.totalScore;
        studentExam.mcqCorrectCount = gradingResult.mcqCorrectCount;
        studentExam.groupCorrectCount = gradingResult.groupCorrectCount;
        studentExam.submittedAt = new Date();
        studentExam.status = StudentExamStatus.SUBMITTED;

        await this.studentExamRepository.save(studentExam);

        return {
            score: gradingResult.totalScore,
            mcqCorrect: gradingResult.mcqCorrectCount,
            groupCorrect: gradingResult.groupCorrectCount,
            hasShortAnswer: !!(studentExam.examSnapshot as ExamSnapshot)?.part3_short_answer?.length,
        };
    }

    async getResult(studentExamId: string): Promise<any> {
        const studentExam = await this.studentExamRepository.findOne({
            where: { id: studentExamId },
            relations: ["student"],
        });

        if (!studentExam) {
            throw new NotFoundException("Student exam not found");
        }

        if (studentExam.status !== StudentExamStatus.SUBMITTED) {
            throw new BadRequestException("Exam not yet submitted");
        }

        return {
            studentName: studentExam.student.fullName,
            score: studentExam.score,
            mcqCorrect: studentExam.mcqCorrectCount,
            groupCorrect: studentExam.groupCorrectCount,
            submittedAt: studentExam.submittedAt,
        };
    }

    async updateScore(studentExamId: string, newScore: number, userId?: string, userRole?: string): Promise<any> {
        const studentExam = await this.studentExamRepository.findOne({
            where: { id: studentExamId },
            relations: ["session"],
        });

        if (!studentExam) {
            throw new NotFoundException("Student exam not found");
        }

        if (studentExam.status !== StudentExamStatus.SUBMITTED) {
            throw new BadRequestException("Chỉ có thể chỉnh điểm bài thi đã nộp.");
        }

        // Chỉ ADMIN hoặc giảng viên đã tạo ca thi mới được chỉnh điểm
        if (userRole !== "ADMIN") {
            const sessionCreatorId = studentExam.session?.createdById;
            if (!sessionCreatorId || sessionCreatorId !== userId) {
                throw new ForbiddenException("Bạn không có quyền chỉnh điểm cho ca thi này. Chỉ giảng viên phụ trách ca thi mới được chỉnh điểm.");
            }
        }

        if (newScore < 0 || newScore > 10) {
            throw new BadRequestException("Điểm phải từ 0 đến 10.");
        }

        studentExam.score = newScore;
        await this.studentExamRepository.save(studentExam);

        return {
            id: studentExam.id,
            score: studentExam.score,
        };
    }
}
