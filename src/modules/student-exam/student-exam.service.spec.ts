import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { StudentExamService } from './student-exam.service';
import { StudentExam } from './entities/student-exam.entity';
import { ExamSnapshotService } from './services/exam-snapshot.service';
import { GradingService } from './services/grading.service';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { StudentExamStatus } from './enums/student-exam-status.enum';

describe('StudentExamService', () => {
    let service: StudentExamService;
    let repo;

    const mockRepo = {
        findOne: jest.fn(),
        save: jest.fn(),
    };

    const mockSnapshotService = {
        sanitizeForFrontend: jest.fn(s => s),
        generateSnapshot: jest.fn(),
    };

    const mockGradingService = {
        gradeExam: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                StudentExamService,
                { provide: getRepositoryToken(StudentExam), useValue: mockRepo },
                { provide: ExamSnapshotService, useValue: mockSnapshotService },
                { provide: GradingService, useValue: mockGradingService },
            ],
        }).compile();

        service = module.get<StudentExamService>(StudentExamService);
        repo = module.get(getRepositoryToken(StudentExam));
    });

    describe('loginWithAccessCode', () => {
        it('should allow login if within time range', async () => {
            const future = new Date(Date.now() + 3600000); // 1 hour later
            const mockExam = { accessCode: 'KEY123', session: { endTime: future } };
            repo.findOne.mockResolvedValue(mockExam);

            const result = await service.loginWithAccessCode('KEY123');
            expect(result).toBe(mockExam);
        });

        it('should throw UnauthorizedException for invalid code', async () => {
            repo.findOne.mockResolvedValue(null);
            await expect(service.loginWithAccessCode('INVALID')).rejects.toThrow(UnauthorizedException);
        });

        it('should throw BadRequestException if session ended', async () => {
            const past = new Date(Date.now() - 3600000); // 1 hour ago
            const mockExam = { accessCode: 'KEY123', session: { endTime: past } };
            repo.findOne.mockResolvedValue(mockExam);

            await expect(service.loginWithAccessCode('KEY123')).rejects.toThrow(BadRequestException);
        });

        it('should throw BadRequestException if exam already submitted', async () => {
            const future = new Date(Date.now() + 3600000);
            const mockExam = {
                accessCode: 'KEY123',
                session: { endTime: future },
                status: StudentExamStatus.SUBMITTED
            };
            repo.findOne.mockResolvedValue(mockExam);

            await expect(service.loginWithAccessCode('KEY123')).rejects.toThrow(BadRequestException);
            await expect(service.loginWithAccessCode('KEY123')).rejects.toThrow('Bài thi đã được nộp, không thể truy cập lại.');
        });
    });

    describe('startExam', () => {
        it('should throw BadRequestException if exam already submitted', async () => {
            const mockExam = {
                id: 'exam-1',
                status: StudentExamStatus.SUBMITTED,
                session: { startTime: new Date() }
            };
            repo.findOne.mockResolvedValue(mockExam);

            await expect(service.startExam('exam-1')).rejects.toThrow(BadRequestException);
            await expect(service.startExam('exam-1')).rejects.toThrow('Bài thi đã được nộp.');
        });
    });

    describe('submitExam', () => {
        it('should reject submission after 60s grace period', async () => {
            const sessionEnd = new Date(Date.now() - 70000); // 70 seconds ago (over 60s limit)
            const mockExam = {
                id: 'exam1',
                status: StudentExamStatus.IN_PROGRESS,
                examSnapshot: {},
                session: { endTime: sessionEnd }
            };
            repo.findOne.mockResolvedValue(mockExam);

            await expect(service.submitExam('exam1', {} as any)).rejects.toThrow(BadRequestException);
            await expect(service.submitExam('exam1', {} as any)).rejects.toThrow('Đã quá thời gian nộp bài.');
        });

        it('should allow submission if within 60s grace period', async () => {
            const sessionEnd = new Date(Date.now() - 30000); // 30 seconds ago (within 60s limit)
            const mockExam = {
                id: 'exam1',
                status: StudentExamStatus.IN_PROGRESS,
                examSnapshot: {},
                session: { endTime: sessionEnd }
            };
            repo.findOne.mockResolvedValue(mockExam);
            mockGradingService.gradeExam.mockResolvedValue({ totalScore: 10, mcqCorrectCount: 20, groupCorrectCount: 10 });

            const result = await service.submitExam('exam1', {} as any);
            expect(result.score).toBe(10);
            expect(repo.save).toHaveBeenCalled();
        });
    });
});
