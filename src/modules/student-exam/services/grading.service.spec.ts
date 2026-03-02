import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GradingService } from './grading.service';
import { Question } from '../../question/entities/question.entity';

describe('GradingService', () => {
    let service: GradingService;
    let questionRepo;

    beforeEach(async () => {
        const mockRepo = {
            findByIds: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GradingService,
                {
                    provide: getRepositoryToken(Question),
                    useValue: mockRepo,
                },
            ],
        }).compile();

        service = module.get<GradingService>(GradingService);
        questionRepo = module.get(getRepositoryToken(Question));
    });

    describe('gradeExam', () => {
        it('should correctly calculate score for complex mix of questions', async () => {
            const snapshot: any = {
                part1_mcq: [
                    { question_id: 'q1', original_question_id: 'orig1' },
                    { question_id: 'q2', original_question_id: 'orig2' },
                ],
                part2_group: [
                    { question_id: 'g1', original_question_id: 'orig3' },
                ],
            };

            const answers: any = {
                mcq_answers: [
                    { question_id: 'q1', selected_option_id: 'opt1' }, // Correct
                    { question_id: 'q2', selected_option_id: 'wrong' }, // Wrong
                ],
                group_answers: [
                    {
                        question_id: 'g1',
                        sub_answers: [
                            { sub_question_id: 'sub1', selected: true }, // Correct
                            { sub_question_id: 'sub2', selected: false }, // Correct
                            { sub_question_id: 'sub3', selected: true }, // Wrong (orig is false)
                            { sub_question_id: 'sub4', selected: true }, // Correct
                        ],
                    },
                ],
            };

            const mockOrigQuestions = [
                { id: 'orig1', data: { correct_option_id: 'opt1' } },
                { id: 'orig2', data: { correct_option_id: 'opt2' } },
                {
                    id: 'orig3',
                    data: {
                        sub_questions: [
                            { id: 'sub1', is_correct: true },
                            { id: 'sub2', is_correct: false },
                            { id: 'sub3', is_correct: false },
                            { id: 'sub4', is_correct: true },
                        ],
                    },
                },
            ];

            questionRepo.findByIds.mockResolvedValue(mockOrigQuestions);

            const result = await service.gradeExam(snapshot, answers);

            // MCQ: 1 correct * 0.25 = 0.25
            // Group: 3 correct subs * 0.25 = 0.75
            // Total = 1.0
            expect(result.totalScore).toBe(1.0);
            expect(result.mcqCorrectCount).toBe(1);
            expect(result.groupCorrectCount).toBe(3);
        });

        it('should handle partially answered group questions', async () => {
            const snapshot: any = {
                part1_mcq: [],
                part2_group: [{ question_id: 'g1', original_question_id: 'orig1' }],
            };

            const answers: any = {
                group_answers: [
                    {
                        question_id: 'g1',
                        sub_answers: [
                            { sub_question_id: 'sub1', selected: true }, // Correct
                            // sub2, sub3, sub4 missing (unanswered)
                        ],
                    },
                ],
            };

            const mockOrigQuestions = [
                {
                    id: 'orig1',
                    data: {
                        sub_questions: [
                            { id: 'sub1', is_correct: true },
                            { id: 'sub2', is_correct: true },
                            { id: 'sub3', is_correct: true },
                            { id: 'sub4', is_correct: true },
                        ],
                    },
                },
            ];

            questionRepo.findByIds.mockResolvedValue(mockOrigQuestions);

            const result = await service.gradeExam(snapshot, answers);

            expect(result.totalScore).toBe(0.25);
            expect(result.groupCorrectCount).toBe(1);
        });

        it('should return 0 score when no answers provided', async () => {
            const snapshot: any = {
                part1_mcq: [{ question_id: 'q1', original_question_id: 'orig1' }],
                part2_group: [{ question_id: 'g1', original_question_id: 'orig2' }],
            };
            const mockOrigQuestions = [
                { id: 'orig1', data: { correct_option_id: 'opt1' } },
                { id: 'orig2', data: { sub_questions: [{ id: 's1', is_correct: true }] } },
            ];

            questionRepo.findByIds.mockResolvedValue(mockOrigQuestions);

            const result = await service.gradeExam(snapshot, { mcq_answers: [], group_answers: [] });

            expect(result.totalScore).toBe(0);
        });

        it('should handle missing original questions gracefully', async () => {
            const snapshot: any = {
                part1_mcq: [{ question_id: 'q1', original_question_id: 'missing-q' }],
                part2_group: [],
            };

            questionRepo.findByIds.mockResolvedValue([]); // Return empty

            const result = await service.gradeExam(snapshot, { mcq_answers: [{ question_id: 'q1', selected_option_id: 'opt1' }], group_answers: [] });

            expect(result.totalScore).toBe(0);
            expect(result.details.mcq[0].answered).toBe(false);
        });
    });
});
