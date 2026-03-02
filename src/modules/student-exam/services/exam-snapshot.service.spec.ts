import { Test, TestingModule } from '@nestjs/testing';
import { ExamSnapshotService } from './exam-snapshot.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Question } from '../../question/entities/question.entity';
import { ExamMatrix } from '../../exam-matrix/entities/exam-matrix.entity';
import { QuestionType } from '../../question/interfaces/question-data.interface';

const mockQuestionRepository = {
    createQueryBuilder: jest.fn(),
};

const mockMatrixRepository = {
    findOne: jest.fn(),
};

describe('ExamSnapshotService', () => {
    let service: ExamSnapshotService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ExamSnapshotService,
                {
                    provide: getRepositoryToken(Question),
                    useValue: mockQuestionRepository,
                },
                {
                    provide: getRepositoryToken(ExamMatrix),
                    useValue: mockMatrixRepository,
                },
            ],
        }).compile();

        service = module.get<ExamSnapshotService>(ExamSnapshotService);
        jest.clearAllMocks();
    });

    describe('generateSnapshot', () => {
        it('should generate a complete snapshot from matrix rules', async () => {
            const matrix = {
                id: 'm1',
                settings: {
                    mcq_rules: [{ pool_id: 'p1', count: 2, cognitive_level: 1 }],
                    group_rules: [{ pool_id: 'p2', count: 1, cognitive_level: 2 }],
                },
            };

            const mcqQuestions = [
                { id: 'q1', content: 'C1', data: { options: [{ id: 'o1', text: 'A' }, { id: 'o2', text: 'B' }] } },
                { id: 'q2', content: 'C2', data: { options: [{ id: 'o3', text: 'C' }] } },
            ];
            const groupQuestion = [
                { id: 'g1', content: 'G1', data: { sub_questions: [{ id: 's1', text: 'S1' }] } },
            ];

            mockMatrixRepository.findOne.mockResolvedValue(matrix);

            const mockQueryBuilder = {
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                getMany: jest.fn()
                    .mockResolvedValueOnce(mcqQuestions)
                    .mockResolvedValueOnce(groupQuestion),
            };
            mockQuestionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

            const result = await service.generateSnapshot('m1');

            expect(result.part1_mcq).toHaveLength(2);
            expect(result.part2_group).toHaveLength(1);
            expect(result.part1_mcq[0].options[0].display_label).toBeDefined();
            expect(result.part2_group[0].sub_questions[0].display_label).toBeDefined();
        });

        it('should throw error if matrix is not found', async () => {
            mockMatrixRepository.findOne.mockResolvedValue(null);
            await expect(service.generateSnapshot('missing')).rejects.toThrow('Exam matrix not found');
        });
    });

    describe('shuffleArray', () => {
        it('should return an array with same elements', () => {
            const arr = [1, 2, 3, 4, 5];
            const result = (service as any).shuffleArray(arr);
            expect(result).toHaveLength(5);
            expect(result).toEqual(expect.arrayContaining(arr));
        });

        it('should not modify original array', () => {
            const arr = [1, 2, 3];
            const original = [...arr];
            (service as any).shuffleArray(arr);
            expect(arr).toEqual(original);
        });
    });
});
