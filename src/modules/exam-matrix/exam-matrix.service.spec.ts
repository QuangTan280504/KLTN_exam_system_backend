import { Test, TestingModule } from '@nestjs/testing';
import { ExamMatrixService } from './exam-matrix.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ExamMatrix } from './entities/exam-matrix.entity';
import { ExamSession } from '../exam-session/entities/exam-session.entity';
import { QuestionPoolService } from '../question-pool/question-pool.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SessionStatus } from '../exam-session/enums/session-status.enum';
import { QuestionType } from '../question/interfaces/question-data.interface';

const mockMatrixRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
};

const mockSessionRepository = {
    count: jest.fn(),
};

const mockPoolService = {
    findOne: jest.fn(),
    getQuestionCount: jest.fn(),
};

describe('ExamMatrixService', () => {
    let service: ExamMatrixService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ExamMatrixService,
                {
                    provide: getRepositoryToken(ExamMatrix),
                    useValue: mockMatrixRepository,
                },
                {
                    provide: getRepositoryToken(ExamSession),
                    useValue: mockSessionRepository,
                },
                {
                    provide: QuestionPoolService,
                    useValue: mockPoolService,
                },
            ],
        }).compile();

        service = module.get<ExamMatrixService>(ExamMatrixService);
        jest.clearAllMocks();
    });

    describe('validateMatrix', () => {
        it('should pass if all rules have enough questions', async () => {
            const settings = {
                mcq_rules: [{ pool_id: 'p1', count: 5, cognitive_level: 1 }],
                group_rules: [{ pool_id: 'p2', count: 2, cognitive_level: 2 }],
            };

            mockPoolService.findOne.mockImplementation((id) => (id === 'p1' ? { name: 'Pool1' } : { name: 'Pool2' }));
            mockPoolService.getQuestionCount.mockResolvedValue(10); // Both have 10

            await expect(service.validateMatrix(settings)).resolves.not.toThrow();
        });

        it('should throw BadRequestException if MCQ pool is insufficient', async () => {
            const settings = {
                mcq_rules: [{ pool_id: 'p1', count: 15, cognitive_level: 1 }],
            };

            mockPoolService.findOne.mockResolvedValue({ name: 'Pool1' });
            mockPoolService.getQuestionCount.mockResolvedValue(10);

            await expect(service.validateMatrix(settings)).rejects.toThrow(BadRequestException);
            await expect(service.validateMatrix(settings)).rejects.toThrow('Gói "Pool1" (Biết) chỉ có 10 câu, nhưng yêu cầu 15 câu');
        });

        it('should throw BadRequestException if Group pool is insufficient', async () => {
            const settings = {
                group_rules: [{ pool_id: 'p2', count: 5, cognitive_level: 3 }],
            };

            mockPoolService.findOne.mockResolvedValue({ name: 'Pool2' });
            mockPoolService.getQuestionCount.mockResolvedValue(3);

            await expect(service.validateMatrix(settings)).rejects.toThrow(BadRequestException);
            await expect(service.validateMatrix(settings)).rejects.toThrow('Gói "Pool2" (Vận dụng) chỉ có 3 câu Đúng/Sai, nhưng yêu cầu 5 câu');
        });
    });

    describe('create', () => {
        it('should validate and save matrix', async () => {
            const dto = { name: 'M1', settings: { mcq_rules: [] } };
            const saved = { id: 'm1', ...dto };

            mockMatrixRepository.create.mockReturnValue(dto);
            mockMatrixRepository.save.mockResolvedValue(saved);

            const result = await service.create(dto as any);

            expect(mockMatrixRepository.save).toHaveBeenCalled();
            expect(result).toEqual(saved);
        });
    });

    describe('update', () => {
        it('should throw error if matrix is used in ACTIVE sessions', async () => {
            const id = 'm1';
            mockMatrixRepository.findOne.mockResolvedValue({ id, name: 'M1' });
            mockSessionRepository.count.mockResolvedValue(1); // 1 active session

            await expect(service.update(id, {})).rejects.toThrow(BadRequestException);
            await expect(service.update(id, {})).rejects.toThrow('Không thể sửa ma trận đề này');
        });

        it('should update matrix if no active sessions', async () => {
            const id = 'm1';
            const existing = { id, name: 'Old', settings: {} };
            const dto = { name: 'New' };
            const updated = { ...existing, ...dto };

            mockMatrixRepository.findOne.mockResolvedValue(existing);
            mockSessionRepository.count.mockResolvedValue(0);
            mockMatrixRepository.save.mockResolvedValue(updated);

            const result = await service.update(id, dto);

            expect(result.name).toBe('New');
            expect(mockMatrixRepository.save).toHaveBeenCalled();
        });
    });

    describe('remove', () => {
        it('should throw error if matrix is used in any sessions', async () => {
            const id = 'm1';
            mockMatrixRepository.findOne.mockResolvedValue({ id, name: 'M1' });
            mockSessionRepository.count.mockResolvedValue(5); // Used in 5 sessions

            await expect(service.remove(id)).rejects.toThrow(BadRequestException);
            await expect(service.remove(id)).rejects.toThrow('Đang được sử dụng bởi 5 ca thi');
        });

        it('should remove matrix if not used', async () => {
            const id = 'm1';
            const matrix = { id, name: 'M1' };
            mockMatrixRepository.findOne.mockResolvedValue(matrix);
            mockSessionRepository.count.mockResolvedValue(0);

            await service.remove(id);

            expect(mockMatrixRepository.remove).toHaveBeenCalledWith(matrix);
        });
    });
});
