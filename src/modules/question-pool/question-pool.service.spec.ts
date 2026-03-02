import { Test, TestingModule } from '@nestjs/testing';
import { QuestionPoolService } from './question-pool.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QuestionPool } from './entities/question-pool.entity';
import { NotFoundException } from '@nestjs/common';

const mockQueryBuilder = {
    createQueryBuilder: jest.fn(),
    leftJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    getRawOne: jest.fn(),
};

const mockPoolRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(() => mockQueryBuilder),
};

const mockMatrixRepository = {
    createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
    })),
};

describe('QuestionPoolService', () => {
    let service: QuestionPoolService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                QuestionPoolService,
                {
                    provide: getRepositoryToken(QuestionPool),
                    useValue: mockPoolRepository,
                },
                {
                    provide: getRepositoryToken(require('../exam-matrix/entities/exam-matrix.entity').ExamMatrix),
                    useValue: mockMatrixRepository,
                },
            ],
        }).compile();

        service = module.get<QuestionPoolService>(QuestionPoolService);
        jest.clearAllMocks();
    });

    describe('create', () => {
        it('should create a question pool successfully', async () => {
            const dto = {
                name: 'Gói câu hỏi 1',
                description: 'Mô tả',
                subjectId: 'sub1',
            };
            const savedPool = { id: 'pool1', ...dto };

            mockPoolRepository.create.mockReturnValue(dto);
            mockPoolRepository.save.mockResolvedValue(savedPool);

            const result = await service.create(dto as any);

            expect(mockPoolRepository.create).toHaveBeenCalledWith(dto);
            expect(mockPoolRepository.save).toHaveBeenCalledWith(dto);
            expect(result).toEqual(savedPool);
        });
    });

    describe('findAll', () => {
        it('should return all pools when no subjectId provided', async () => {
            const pools = [
                { id: 'pool1', name: 'Pool 1' },
                { id: 'pool2', name: 'Pool 2' },
            ];

            mockPoolRepository.find.mockResolvedValue(pools);

            const result = await service.findAll();

            expect(mockPoolRepository.find).toHaveBeenCalledWith({
                where: {},
                relations: ['subject'],
                order: { name: 'ASC' },
            });
            expect(result).toEqual(pools);
        });

        it('should filter by subjectId when provided', async () => {
            const pools = [{ id: 'pool1', name: 'Pool 1', subjectId: 'sub1' }];

            mockPoolRepository.find.mockResolvedValue(pools);

            const result = await service.findAll('sub1');

            expect(mockPoolRepository.find).toHaveBeenCalledWith({
                where: { subjectId: 'sub1' },
                relations: ['subject'],
                order: { name: 'ASC' },
            });
            expect(result).toEqual(pools);
        });
    });

    describe('findOne', () => {
        it('should return a pool with relations', async () => {
            const pool = {
                id: 'pool1',
                name: 'Pool 1',
                subject: { id: 'sub1', name: 'Tin học' },
            };

            mockPoolRepository.findOne.mockResolvedValue(pool);

            const result = await service.findOne('pool1');

            expect(mockPoolRepository.findOne).toHaveBeenCalledWith({
                where: { id: 'pool1' },
                relations: ['subject'],
            });
            expect(result).toEqual(pool);
        });

        it('should throw NotFoundException when pool not found', async () => {
            mockPoolRepository.findOne.mockResolvedValue(null);

            await expect(service.findOne('999')).rejects.toThrow(NotFoundException);
            await expect(service.findOne('999')).rejects.toThrow('Question Pool with ID 999 not found');
        });
    });

    describe('update', () => {
        it('should update a pool successfully', async () => {
            const existingPool = { id: 'pool1', name: 'Pool 1' };
            const updateDto = { name: 'Pool 1 Updated' };
            const updatedPool = { ...existingPool, ...updateDto };

            mockPoolRepository.findOne.mockResolvedValue(existingPool);
            mockPoolRepository.save.mockResolvedValue(updatedPool);

            const result = await service.update('pool1', updateDto);

            expect(result).toEqual(updatedPool);
        });
    });

    describe('remove', () => {
        it('should remove a pool successfully', async () => {
            const pool = { id: 'pool1', name: 'Pool 1' };

            mockPoolRepository.findOne.mockResolvedValue(pool);
            mockPoolRepository.remove.mockResolvedValue(pool);

            await service.remove('pool1');

            expect(mockPoolRepository.remove).toHaveBeenCalledWith(pool);
        });
    });

    describe('getQuestionCount', () => {
        it('should count all questions in a pool', async () => {
            mockQueryBuilder.getRawOne.mockResolvedValue({ count: '10' });

            const result = await service.getQuestionCount('pool1');

            expect(mockPoolRepository.createQueryBuilder).toHaveBeenCalledWith('pool');
            expect(mockQueryBuilder.leftJoin).toHaveBeenCalledWith('pool.questions', 'question');
            expect(mockQueryBuilder.where).toHaveBeenCalledWith('pool.id = :poolId', { poolId: 'pool1' });
            expect(result).toBe(10);
        });

        it('should count questions filtered by type', async () => {
            mockQueryBuilder.getRawOne.mockResolvedValue({ count: '5' });

            const result = await service.getQuestionCount('pool1', 'MCQ');

            expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('question.questionType = :type', {
                type: 'MCQ',
            });
            expect(result).toBe(5);
        });

        it('should count questions filtered by cognitive level', async () => {
            mockQueryBuilder.getRawOne.mockResolvedValue({ count: '3' });

            const result = await service.getQuestionCount('pool1', undefined, 2);

            expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('question.cognitiveLevel = :level', {
                level: 2,
            });
            expect(result).toBe(3);
        });

        it('should count questions filtered by both type and level', async () => {
            mockQueryBuilder.getRawOne.mockResolvedValue({ count: '2' });

            const result = await service.getQuestionCount('pool1', 'GROUP', 3);

            expect(mockQueryBuilder.andWhere).toHaveBeenCalledTimes(2);
            expect(result).toBe(2);
        });
    });
});
