import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { v4 as uuidv4 } from "uuid";
import { ExamMatrix } from "../../exam-matrix/entities/exam-matrix.entity";
import { Question } from "../../question/entities/question.entity";
import { MCQData, GroupData, ShortAnswerData, QuestionType } from "../../question/interfaces/question-data.interface";
import { ExamSnapshot, MCQSnapshotQuestion, GroupSnapshotQuestion, ShortAnswerSnapshotQuestion } from "../interfaces/exam-snapshot.interface";

@Injectable()
export class ExamSnapshotService {
    constructor(
        @InjectRepository(Question)
        private questionRepository: Repository<Question>,
        @InjectRepository(ExamMatrix)
        private matrixRepository: Repository<ExamMatrix>,
    ) {}

    async generateSnapshot(matrixId: string): Promise<ExamSnapshot> {
        const matrix = await this.matrixRepository.findOne({
            where: { id: matrixId },
        });

        if (!matrix) {
            throw new Error("Exam matrix not found");
        }

        const settings = matrix.settings;

        // Collect questions by rules (random from pools)
        const mcqQuestions = await this.collectQuestionsByRules(settings.mcq_rules, QuestionType.MCQ);
        const groupQuestions = await this.collectQuestionsByRules(settings.group_rules, QuestionType.GROUP);
        const shortAnswerQuestions = settings.short_answer_rules ? await this.collectQuestionsByRules(settings.short_answer_rules, QuestionType.SHORT_ANSWER) : [];

        // Collect fixed questions (always included)
        const fixedMcq = settings.fixed_mcq_ids?.length ? await this.questionRepository.findByIds(settings.fixed_mcq_ids) : [];
        const fixedGroup = settings.fixed_group_ids?.length ? await this.questionRepository.findByIds(settings.fixed_group_ids) : [];
        const fixedShortAnswer = settings.fixed_short_answer_ids?.length ? await this.questionRepository.findByIds(settings.fixed_short_answer_ids) : [];

        // Merge: pool questions + fixed questions
        const allMCQ = [...mcqQuestions, ...fixedMcq];
        const allGroup = [...groupQuestions, ...fixedGroup];
        const allShortAnswer = [...shortAnswerQuestions, ...fixedShortAnswer];

        // Shuffle question order (Fisher-Yates)
        const shuffledMCQ = this.shuffleArray(allMCQ);
        const shuffledGroup = this.shuffleArray(allGroup);
        const shuffledShortAnswer = this.shuffleArray(allShortAnswer);

        // Build snapshot with shuffled options/sub-questions
        const part1 = shuffledMCQ.map((q) => this.buildMCQSnapshot(q));
        const part2 = shuffledGroup.map((q) => this.buildGroupSnapshot(q));
        const part3 = shuffledShortAnswer.map((q) => this.buildShortAnswerSnapshot(q));

        const snapshot: ExamSnapshot = {
            part1_mcq: part1,
            part2_group: part2,
        };

        if (part3.length > 0) {
            snapshot.part3_short_answer = part3;
        }

        return snapshot;
    }

    private async collectQuestionsByRules(rules: any[], type: QuestionType): Promise<Question[]> {
        const allQuestions: Question[] = [];
        const excludeIds: string[] = []; // Track IDs to prevent duplicates

        for (const rule of rules) {
            const queryBuilder = this.questionRepository.createQueryBuilder("q").where("q.pool_id = :poolId", { poolId: rule.pool_id }).andWhere("q.question_type = :type", { type });

            if (rule.cognitive_level) {
                queryBuilder.andWhere("q.cognitive_level = :level", {
                    level: rule.cognitive_level,
                });
            }

            // Important: Exclude questions already picked by previous rules
            if (excludeIds.length > 0) {
                queryBuilder.andWhere("q.id NOT IN (:...excludeIds)", { excludeIds });
            }

            // Random selection
            // Note: Postgres uses RANDOM(), MySQL uses RAND()
            queryBuilder.orderBy("RANDOM()").limit(rule.count);

            const questions = await queryBuilder.getMany();

            // Add picked questions to list and exclusion set
            for (const q of questions) {
                allQuestions.push(q);
                excludeIds.push(q.id);
            }
        }

        return allQuestions;
    }

    private buildMCQSnapshot(question: Question): MCQSnapshotQuestion {
        const data = question.data as MCQData;
        const shuffledOptions = this.shuffleArray([...data.options]);

        // Reassign display labels
        const labels = ["A", "B", "C", "D"];
        const optionsWithNewLabels = shuffledOptions.map((opt, idx) => ({
            id: opt.id,
            text: opt.text,
            display_label: labels[idx],
        }));

        return {
            question_id: uuidv4(),
            original_question_id: question.id,
            content: question.content,
            cognitive_level: question.cognitiveLevel,
            images: question.images || [],
            options: optionsWithNewLabels,
        };
    }

    private buildGroupSnapshot(question: Question): GroupSnapshotQuestion {
        const data = question.data as GroupData;
        const shuffledSubs = this.shuffleArray([...data.sub_questions]);

        const labels = ["a", "b", "c", "d"];
        const subsWithNewLabels = shuffledSubs.map((sub, idx) => ({
            id: sub.id,
            text: sub.text,
            display_label: labels[idx],
        }));

        return {
            question_id: uuidv4(),
            original_question_id: question.id,
            content: question.content,
            cognitive_level: question.cognitiveLevel,
            images: question.images || [],
            sub_questions: subsWithNewLabels,
        };
    }

    private buildShortAnswerSnapshot(question: Question): ShortAnswerSnapshotQuestion {
        return {
            question_id: uuidv4(),
            original_question_id: question.id,
            content: question.content,
            cognitive_level: question.cognitiveLevel,
            images: question.images || [],
        };
    }

    /**
     * Fisher-Yates shuffle algorithm
     */
    private shuffleArray<T>(array: T[]): T[] {
        const result = [...array];
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    }

    /**
     * Remove sensitive data before sending to frontend
     * Note: We already don't include is_correct in the snapshot structure
     */
    sanitizeForFrontend(snapshot: ExamSnapshot): ExamSnapshot {
        return snapshot; // Already safe
    }
}
