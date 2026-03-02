import { Test, TestingModule } from '@nestjs/testing';
import { ExamSessionService } from './exam-session.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ExamSession } from './entities/exam-session.entity';
import { Student } from '../student/entities/student.entity';
import { StudentExam } from '../student-exam/entities/student-exam.entity';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { SessionStatus } from './enums/session-status.enum';

const mockSessionRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
};

const mockStudentRepository = {
    findOne: jest.fn(),
};

const mockStudentExamRepository = {
    find: jest.fn(),
};

describe('ExamSessionService', () => {
    let service: ExamSessionService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ExamSessionService,
                {
                    provide: getRepositoryToken(ExamSession),
                    useValue: mockSessionRepository,
                },
                {
                    provide: getRepositoryToken(Student),
                    useValue: mockStudentRepository,
                },
                {
                    provide: getRepositoryToken(StudentExam),
                    useValue: mockStudentExamRepository,
                },
            ],
        }).compile();

        service = module.get<ExamSessionService>(ExamSessionService);
        jest.clearAllMocks();
    });

    describe('update', () => {
        it('should allow updating everything if status is DRAFT', async () => {
            const id = 's1';
            const session = { id, status: SessionStatus.DRAFT, matrixId: 'm1', startTime: new Date() };
            const dto = { matrixId: 'm2', name: 'New Name' };

            mockSessionRepository.findOne.mockResolvedValue(session);
            mockSessionRepository.save.mockResolvedValue({ ...session, ...dto });

            const result = await service.update(id, dto);
            expect(result.matrixId).toBe('m2');
            expect(mockSessionRepository.save).toHaveBeenCalled();
        });

        it('should block matrixId update if status is ACTIVE', async () => {
            const id = 's1';
            const session = { id, status: SessionStatus.ACTIVE, matrixId: 'm1' };
            const dto = { matrixId: 'm2' };

            mockSessionRepository.findOne.mockResolvedValue(session);

            await expect(service.update(id, dto)).rejects.toThrow(BadRequestException);
            await expect(service.update(id, dto)).rejects.toThrow('Không thể thay đổi đề thi');
        });

        it('should block startTime update if status is ACTIVE', async () => {
            const id = 's1';
            const oldDate = new Date('2026-01-01');
            const session = { id, status: SessionStatus.ACTIVE, startTime: oldDate };
            const dto = { startTime: new Date('2026-01-02') };

            mockSessionRepository.findOne.mockResolvedValue(session);

            await expect(service.update(id, dto)).rejects.toThrow(BadRequestException);
            await expect(service.update(id, dto)).rejects.toThrow('Không thể thay đổi thời gian');
        });

        it('should allow non-critical updates even if ACTIVE', async () => {
            const id = 's1';
            const session = { id, status: SessionStatus.ACTIVE, name: 'Old' };
            const dto = { name: 'New' };

            mockSessionRepository.findOne.mockResolvedValue(session);
            mockSessionRepository.save.mockResolvedValue({ ...session, ...dto });

            const result = await service.update(id, dto);
            expect(result.name).toBe('New');
        });
    });

    describe('remove', () => {
        it('should throw error if session is not DRAFT', async () => {
            const id = 's1';
            mockSessionRepository.findOne.mockResolvedValue({ id, status: SessionStatus.ACTIVE });

            await expect(service.remove(id)).rejects.toThrow(BadRequestException);
            await expect(service.remove(id)).rejects.toThrow('Chỉ có thể xóa ca thi ở trạng thái Nháp');
        });

        it('should remove session if status is DRAFT', async () => {
            const id = 's1';
            const session = { id, status: SessionStatus.DRAFT };
            mockSessionRepository.findOne.mockResolvedValue(session);

            await service.remove(id);
            expect(mockSessionRepository.remove).toHaveBeenCalledWith(session);
        });
    });

    describe('generateAccessCode', () => {
        it('should return a 10-character code', () => {
            const code = service.generateAccessCode();
            expect(code.length).toBe(10);
            expect(code).toMatch(/^[A-Z0-9]+$/);
        });
    });
});
