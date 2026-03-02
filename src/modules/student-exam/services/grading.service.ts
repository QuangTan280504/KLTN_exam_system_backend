import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Question } from '../../question/entities/question.entity';
import {
    MCQData,
    GroupData,
} from '../../question/interfaces/question-data.interface';
import {
    ExamSnapshot,
    StudentAnswers,
    GradingResult,
    MCQSnapshotQuestion,
    GroupSnapshotQuestion,
} from '../interfaces/exam-snapshot.interface';

@Injectable()
export class GradingService {
    constructor(
        @InjectRepository(Question)
        private questionRepository: Repository<Question>,
    ) { }

    async gradeExam(
        snapshot: ExamSnapshot,
        answers: StudentAnswers,
    ): Promise<GradingResult> {
        // Get all original questions
        const originalQuestionIds = [
            ...snapshot.part1_mcq.map((q) => q.original_question_id),
            ...snapshot.part2_group.map((q) => q.original_question_id),
        ];

        const originalQuestions = await this.questionRepository.findByIds(
            originalQuestionIds,
        );

        // Create a map for quick lookup
        const questionMap = new Map<string, Question>();
        originalQuestions.forEach((q) => questionMap.set(q.id, q));

        // Grade MCQ
        const mcqResult = this.gradeMCQ(
            snapshot.part1_mcq,
            answers.mcq_answers || [],
            questionMap,
        );

        // Grade Group
        const groupResult = this.gradeGroup(
            snapshot.part2_group,
            answers.group_answers || [],
            questionMap,
        );

        const totalScore = mcqResult.score + groupResult.score;

        return {
            mcqCorrectCount: mcqResult.correctCount,
            groupCorrectCount: groupResult.correctCount,
            totalScore,
            details: {
                mcq: mcqResult.details,
                group: groupResult.details,
            },
        };
    }

    private gradeMCQ(
        snapshotMCQ: MCQSnapshotQuestion[],
        studentMCQAnswers: any[],
        questionMap: Map<string, Question>,
    ) {
        let correctCount = 0;
        const details = [];

        for (const snapshotQ of snapshotMCQ) {
            const studentAnswer = studentMCQAnswers.find(
                (a) => a.question_id === snapshotQ.question_id,
            );
            const originalQ = questionMap.get(snapshotQ.original_question_id);

            if (!originalQ || !studentAnswer) {
                details.push({
                    questionId: snapshotQ.question_id,
                    correct: false,
                    answered: false,
                });
                continue;
            }

            const originalData = originalQ.data as MCQData;
            const isCorrect =
                studentAnswer.selected_option_id === originalData.correct_option_id;

            if (isCorrect) correctCount++;

            details.push({
                questionId: snapshotQ.question_id,
                correct: isCorrect,
                answered: true,
            });
        }

        return {
            correctCount,
            score: correctCount * 0.25, // 0.25 điểm mỗi câu MCQ
            details,
        };
    }

    private gradeGroup(
        snapshotGroup: GroupSnapshotQuestion[],
        studentGroupAnswers: any[],
        questionMap: Map<string, Question>,
    ) {
        let correctCount = 0;
        const details = [];

        for (const snapshotQ of snapshotGroup) {
            const studentAnswer = studentGroupAnswers.find(
                (a) => a.question_id === snapshotQ.question_id,
            );
            const originalQ = questionMap.get(snapshotQ.original_question_id);

            if (!originalQ || !studentAnswer) {
                details.push({
                    questionId: snapshotQ.question_id,
                    correctSubCount: 0,
                });
                continue;
            }

            const originalData = originalQ.data as GroupData;
            let questionCorrectCount = 0;

            // Check each sub-question
            for (const studentSub of studentAnswer.sub_answers || []) {
                const originalSub = originalData.sub_questions.find(
                    (s) => s.id === studentSub.sub_question_id,
                );

                if (originalSub && studentSub.selected === originalSub.is_correct) {
                    correctCount++;
                    questionCorrectCount++;
                }
            }

            details.push({
                questionId: snapshotQ.question_id,
                correctSubCount: questionCorrectCount,
            });
        }

        return {
            correctCount,
            score: correctCount * 0.25, // 0.25 điểm mỗi ý đúng
            details,
        };
    }
}
