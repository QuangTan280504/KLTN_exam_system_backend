import { Test, TestingModule } from '@nestjs/testing';
import { QuestionService } from './question.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Question } from './entities/question.entity';
import { ExcelImportService } from './services/excel-import.service';
import { QuestionType, CognitiveLevel } from './interfaces/question-data.interface';
import { BadRequestException, NotFoundException } from '@nestjs/common';

const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getCount: jest.fn(),
    getMany: jest.fn(),
};

const mockQuestionRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(() => mockQueryBuilder),
};

const mockExcelImportService = {
    parseExcelFile: jest.fn(),
};

describe('QuestionService', () => {
    let service: QuestionService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                QuestionService,
                {
                    provide: getRepositoryToken(Question),
                    useValue: mockQuestionRepository,
                },
                {
                    provide: ExcelImportService,
                    useValue: mockExcelImportService,
                },
            ],
        }).compile();

        service = module.get<QuestionService>(QuestionService);
        jest.clearAllMocks();
    });

    describe('create - MCQ', () => {
        it('should create MCQ question with generated UUIDs', async () => {
            const dto = {
                poolId: 'pool1',
                questionType: QuestionType.MCQ,
                content: 'Câu hỏi test',
                cognitiveLevel: CognitiveLevel.BIET,
                data: {
                    options: [
                        { text: 'Đáp án A', label: 'A' },
                        { text: 'Đáp án B', label: 'B' },
                        { text: 'Đáp án C', label: 'C' },
                        { text: 'Đáp án D', label: 'D' },
                    ],
                    correctLabel: 'B',
                },
            };

            const savedQuestion = { id: 'q1', ...dto };
            mockQuestionRepository.create.mockReturnValue(savedQuestion);
            mockQuestionRepository.save.mockResolvedValue(savedQuestion);

            const result = await service.create(dto as any);

            expect(mockQuestionRepository.create).toHaveBeenCalled();
            const createArg = mockQuestionRepository.create.mock.calls[0][0];
            expect(createArg.data.options).toHaveLength(4);
            expect(createArg.data.options[0].id).toBeDefined();
            expect(createArg.data.correct_option_id).toBeDefined();
            expect(result).toEqual(savedQuestion);
        });

        it('should throw error when correct answer label not found', async () => {
            const dto = {
                poolId: 'pool1',
                questionType: QuestionType.MCQ,
                content: 'Câu hỏi test',
                cognitiveLevel: CognitiveLevel.BIET,
                data: {
                    options: [
                        { text: 'Đáp án A', label: 'A' },
                        { text: 'Đáp án B', label: 'B' },
                    ],
                    correctLabel: 'Z', // Invalid
                },
            };

            await expect(service.create(dto as any)).rejects.toThrow(BadRequestException);
            await expect(service.create(dto as any)).rejects.toThrow('Correct answer label not found');
        });
    });

    describe('create - GROUP', () => {
        it('should create GROUP question with generated UUIDs', async () => {
            const dto = {
                poolId: 'pool1',
                questionType: QuestionType.GROUP,
                content: 'Câu dẫn',
                cognitiveLevel: CognitiveLevel.HIEU,
                data: {
                    sub_questions: [
                        { text: 'Ý a', label: 'a', is_correct: true },
                        { text: 'Ý b', label: 'b', is_correct: false },
                        { text: 'Ý c', label: 'c', is_correct: true },
                        { text: 'Ý d', label: 'd', is_correct: false },
                    ],
                },
            };

            const savedQuestion = { id: 'q2', ...dto };
            mockQuestionRepository.create.mockReturnValue(savedQuestion);
            mockQuestionRepository.save.mockResolvedValue(savedQuestion);

            const result = await service.create(dto as any);

            const createArg = mockQuestionRepository.create.mock.calls[0][0];
            expect(createArg.data.sub_questions).toHaveLength(4);
            expect(createArg.data.sub_questions[0].id).toBeDefined();
            expect(result).toEqual(savedQuestion);
        });
    });

    describe('findByPool', () => {
        it('should return questions filtered by poolId only', async () => {
            const questions = [{ id: 'q1' }, { id: 'q2' }];
            mockQueryBuilder.getMany.mockResolvedValue(questions);
            mockQueryBuilder.getCount.mockResolvedValue(2);

            const result = await service.findByPool('pool1');

            expect(mockQuestionRepository.createQueryBuilder).toHaveBeenCalledWith('q');
            expect(mockQueryBuilder.where).toHaveBeenCalledWith('q.pool_id = :poolId', { poolId: 'pool1' });
            expect(result.items).toEqual(questions);
            expect(result.total).toBe(2);
        });

        it('should filter by questionType when provided', async () => {
            mockQueryBuilder.getMany.mockResolvedValue([]);

            await service.findByPool('pool1', QuestionType.MCQ);

            expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('q.question_type = :questionType', {
                questionType: QuestionType.MCQ,
            });
        });

        it('should filter by cognitiveLevel when provided', async () => {
            mockQueryBuilder.getMany.mockResolvedValue([]);

            await service.findByPool('pool1', undefined, CognitiveLevel.VAN_DUNG);

            expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('q.cognitive_level = :cognitiveLevel', {
                cognitiveLevel: CognitiveLevel.VAN_DUNG,
            });
        });
    });

    describe('findRandomByPool', () => {
        it('should return random questions with RANDOM() order', async () => {
            const questions = [{ id: 'q1' }, { id: 'q2' }];
            mockQueryBuilder.getMany.mockResolvedValue(questions);

            const result = await service.findRandomByPool('pool1', 2);

            expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('RANDOM()');
            expect(mockQueryBuilder.limit).toHaveBeenCalledWith(2);
            expect(result).toEqual(questions);
        });

        it('should apply filters and randomization', async () => {
            mockQueryBuilder.getMany.mockResolvedValue([]);

            await service.findRandomByPool('pool1', 5, QuestionType.GROUP, CognitiveLevel.HIEU);

            expect(mockQueryBuilder.andWhere).toHaveBeenCalledTimes(2);
            expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('RANDOM()');
            expect(mockQueryBuilder.limit).toHaveBeenCalledWith(5);
        });
    });

    describe('findOne', () => {
        it('should return a question by ID', async () => {
            const question = { id: 'q1', content: 'Test' };
            mockQuestionRepository.findOne.mockResolvedValue(question);

            const result = await service.findOne('q1');

            expect(result).toEqual(question);
        });

        it('should throw NotFoundException when not found', async () => {
            mockQuestionRepository.findOne.mockResolvedValue(null);

            await expect(service.findOne('999')).rejects.toThrow(NotFoundException);
        });
    });

    describe('update', () => {
        it('should update a question', async () => {
            const question = { id: 'q1', content: 'Old' };
            const updateDto = { content: 'New' };
            const updated = { ...question, ...updateDto };

            mockQuestionRepository.findOne.mockResolvedValue(question);
            mockQuestionRepository.save.mockResolvedValue(updated);

            const result = await service.update('q1', updateDto);

            expect(result).toEqual(updated);
        });
    });

    describe('remove', () => {
        it('should remove a question', async () => {
            const question = { id: 'q1' };
            mockQuestionRepository.findOne.mockResolvedValue(question);
            mockQuestionRepository.remove.mockResolvedValue(question);

            await service.remove('q1');

            expect(mockQuestionRepository.remove).toHaveBeenCalledWith(question);
        });
    });

    describe('importFromExcel', () => {
        it('should import MCQ and GROUP questions successfully', async () => {
            const file = { buffer: Buffer.from('test') } as Express.Multer.File;
            const parsed = {
                mcqQuestions: [
                    {
                        content: 'Q1',
                        cognitiveLevel: 1,
                        data: { options: [], correct_option_id: 'id1' },
                    },
                ],
                groupQuestions: [
                    {
                        content: 'G1',
                        cognitiveLevel: 2,
                        data: { sub_questions: [] },
                    },
                ],
            };

            mockExcelImportService.parseExcelFile.mockResolvedValue(parsed);
            mockQuestionRepository.create.mockImplementation((q) => q);
            mockQuestionRepository.save.mockResolvedValue({});

            const result = await service.importFromExcel('pool1', file);

            expect(result.mcq.total).toBe(1);
            expect(result.mcq.success).toBe(1);
            expect(result.group.total).toBe(1);
            expect(result.group.success).toBe(1);
        });

        it('should handle import errors gracefully', async () => {
            const file = { buffer: Buffer.from('test') } as Express.Multer.File;
            mockExcelImportService.parseExcelFile.mockRejectedValue(new Error('Parse error'));

            await expect(service.importFromExcel('pool1', file)).rejects.toThrow(BadRequestException);
        });
    });
});
