import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { v4 as uuidv4 } from "uuid";
import { ExamMatrix } from "./entities/exam-matrix.entity";
import { CreateExamMatrixDto } from "./dto/create-exam-matrix.dto";
import { UpdateExamMatrixDto } from "./dto/update-exam-matrix.dto";
import { QuestionPoolService } from "../question-pool/question-pool.service";
import { QuestionType } from "../question/interfaces/question-data.interface";
import { Question } from "../question/entities/question.entity";
import { ExamSession } from "../exam-session/entities/exam-session.entity";
import { SessionStatus } from "../exam-session/enums/session-status.enum";
import { CustomQuestionInput, UpdateQuestionInput } from "./interfaces/matrix-settings.interface";

@Injectable()
export class ExamMatrixService {
    constructor(
        @InjectRepository(ExamMatrix)
        private matrixRepository: Repository<ExamMatrix>,
        @InjectRepository(ExamSession)
        private sessionRepository: Repository<ExamSession>,
        @InjectRepository(Question)
        private questionRepository: Repository<Question>,
        private questionPoolService: QuestionPoolService,
    ) {}

    async create(createDto: CreateExamMatrixDto): Promise<ExamMatrix> {
        // Process custom questions → create DB records → store IDs in settings
        if (createDto.customQuestions?.length) {
            await this.processCustomQuestions(createDto);
        }

        // Validation logic (only for pool-based rules)
        await this.validateMatrix(createDto.settings);

        const matrix = this.matrixRepository.create({
            name: createDto.name,
            description: createDto.description,
            subjectId: createDto.subjectId,
            duration: createDto.duration,
            settings: createDto.settings,
            totalMcqCount: createDto.totalMcqCount,
            totalGroupCount: createDto.totalGroupCount,
            totalShortAnswerCount: createDto.totalShortAnswerCount,
        });
        return await this.matrixRepository.save(matrix);
    }

    /**
     * Process custom inline questions: create Question records in DB,
     * then store their IDs in settings.fixed_*_ids
     */
    private async processCustomQuestions(dto: CreateExamMatrixDto): Promise<void> {
        const fixedMcqIds: string[] = [...(dto.settings.fixed_mcq_ids || [])];
        const fixedGroupIds: string[] = [...(dto.settings.fixed_group_ids || [])];
        const fixedShortAnswerIds: string[] = [...(dto.settings.fixed_short_answer_ids || [])];

        for (const cq of dto.customQuestions) {
            // Validate custom question data based on type
            this.validateCustomQuestion(cq);

            const question = this.questionRepository.create({
                poolId: null, // Standalone question, not in any pool
                questionType: cq.type as QuestionType,
                content: cq.content,
                cognitiveLevel: cq.cognitive_level,
                data: cq.data,
            });

            const saved = await this.questionRepository.save(question);

            if (cq.type === "MCQ") {
                fixedMcqIds.push(saved.id);
            } else if (cq.type === "GROUP") {
                fixedGroupIds.push(saved.id);
            } else if (cq.type === "SHORT_ANSWER") {
                fixedShortAnswerIds.push(saved.id);
            }
        }

        // Update settings with fixed IDs
        if (fixedMcqIds.length > 0) dto.settings.fixed_mcq_ids = fixedMcqIds;
        if (fixedGroupIds.length > 0) dto.settings.fixed_group_ids = fixedGroupIds;
        if (fixedShortAnswerIds.length > 0) dto.settings.fixed_short_answer_ids = fixedShortAnswerIds;
    }

    private validateCustomQuestion(cq: CustomQuestionInput): void {
        if (!cq.content?.trim()) {
            throw new BadRequestException("Nội dung câu hỏi không được để trống.");
        }
        if (!cq.cognitive_level || cq.cognitive_level < 1 || cq.cognitive_level > 3) {
            throw new BadRequestException("Mức độ nhận thức phải từ 1-3.");
        }

        if (cq.type === "MCQ") {
            const data = cq.data;
            if (!data?.options || data.options.length < 2) {
                throw new BadRequestException("Câu MCQ phải có ít nhất 2 đáp án.");
            }
            if (!data.correct_option_id) {
                throw new BadRequestException("Câu MCQ phải chỉ định đáp án đúng.");
            }
            // Ensure options have IDs
            for (const opt of data.options) {
                if (!opt.id) opt.id = uuidv4();
            }
        } else if (cq.type === "GROUP") {
            const data = cq.data;
            if (!data?.sub_questions || data.sub_questions.length < 2) {
                throw new BadRequestException("Câu Đúng/Sai phải có ít nhất 2 ý.");
            }
            // Ensure sub-questions have IDs
            for (const sub of data.sub_questions) {
                if (!sub.id) sub.id = uuidv4();
            }
        }
        // SHORT_ANSWER: no special data validation needed
    }

    async validateMatrix(settings: any): Promise<void> {
        const errors = [];

        // Validate MCQ Rules
        if (settings.mcq_rules) {
            for (const rule of settings.mcq_rules) {
                const pool = await this.questionPoolService.findOne(rule.pool_id);
                const count = await this.questionPoolService.getQuestionCount(rule.pool_id, QuestionType.MCQ, rule.cognitive_level);
                if (count < rule.count) {
                    const levelText = rule.cognitive_level === 1 ? "Biết" : rule.cognitive_level === 2 ? "Hiểu" : "Vận dụng";
                    errors.push(`Gói "${pool.name}" (${levelText}) chỉ có ${count} câu, nhưng yêu cầu ${rule.count} câu`);
                }
            }
        }

        // Validate Group Rules
        if (settings.group_rules) {
            for (const rule of settings.group_rules) {
                const pool = await this.questionPoolService.findOne(rule.pool_id);
                const count = await this.questionPoolService.getQuestionCount(rule.pool_id, QuestionType.GROUP, rule.cognitive_level);
                if (count < rule.count) {
                    const levelText = rule.cognitive_level === 1 ? "Biết" : rule.cognitive_level === 2 ? "Hiểu" : "Vận dụng";
                    errors.push(`Gói "${pool.name}" (${levelText}) chỉ có ${count} câu Đúng/Sai, nhưng yêu cầu ${rule.count} câu`);
                }
            }
        }

        // Validate Short Answer Rules
        if (settings.short_answer_rules) {
            for (const rule of settings.short_answer_rules) {
                const pool = await this.questionPoolService.findOne(rule.pool_id);
                const count = await this.questionPoolService.getQuestionCount(rule.pool_id, QuestionType.SHORT_ANSWER, rule.cognitive_level);
                if (count < rule.count) {
                    const levelText = rule.cognitive_level === 1 ? "Biết" : rule.cognitive_level === 2 ? "Hiểu" : "Vận dụng";
                    errors.push(`Gói "${pool.name}" (${levelText}) chỉ có ${count} câu Trả lời ngắn, nhưng yêu cầu ${rule.count} câu`);
                }
            }
        }

        if (errors.length > 0) {
            throw new BadRequestException(errors.join("; "));
        }
    }

    async findAll(): Promise<ExamMatrix[]> {
        return await this.matrixRepository.find({
            relations: ["subject"],
            order: { name: "ASC" },
        });
    }

    async findOne(id: string): Promise<ExamMatrix> {
        const matrix = await this.matrixRepository.findOne({
            where: { id },
            relations: ["subject"],
        });
        if (!matrix) {
            throw new NotFoundException(`Exam Matrix with ID ${id} not found`);
        }
        return matrix;
    }

    /**
     * Lấy danh sách câu hỏi riêng (fixed questions) của ma trận để hiển thị khi sửa.
     */
    async getFixedQuestions(matrixId: string): Promise<{ mcq: Question[]; group: Question[]; shortAnswer: Question[] }> {
        const matrix = await this.findOne(matrixId);
        const settings = matrix.settings || ({} as any);

        const mcqIds = settings.fixed_mcq_ids || [];
        const groupIds = settings.fixed_group_ids || [];
        const saIds = settings.fixed_short_answer_ids || [];

        const [mcq, group, shortAnswer] = await Promise.all([mcqIds.length > 0 ? this.questionRepository.findByIds(mcqIds) : [], groupIds.length > 0 ? this.questionRepository.findByIds(groupIds) : [], saIds.length > 0 ? this.questionRepository.findByIds(saIds) : []]);

        return { mcq, group, shortAnswer };
    }

    /**
     * Cập nhật nội dung các câu hỏi riêng đã tồn tại.
     */
    private async updateExistingQuestions(updates: UpdateQuestionInput[]): Promise<void> {
        for (const upd of updates) {
            const question = await this.questionRepository.findOne({ where: { id: upd.id } });
            if (!question) {
                throw new NotFoundException(`Không tìm thấy câu hỏi với ID ${upd.id}`);
            }
            question.content = upd.content;
            question.cognitiveLevel = upd.cognitive_level;
            question.data = upd.data;
            await this.questionRepository.save(question);
        }
    }

    async update(id: string, updateDto: UpdateExamMatrixDto): Promise<ExamMatrix> {
        const matrix = await this.findOne(id);

        // Check if being used by ACTIVE sessions
        const activeSessionsCount = await this.sessionRepository.count({
            where: {
                matrixId: id,
                status: SessionStatus.ACTIVE,
            },
        });

        if (activeSessionsCount > 0) {
            throw new BadRequestException(`Không thể sửa ma trận đề này vì đang có ${activeSessionsCount} ca thi đang diễn ra (ACTIVE).`);
        }

        // Process custom questions if provided (new custom questions)
        if (updateDto.customQuestions?.length && updateDto.settings) {
            await this.processCustomQuestions(updateDto as CreateExamMatrixDto);
        }

        // Update existing fixed questions if provided
        if ((updateDto as any).updateQuestions?.length) {
            await this.updateExistingQuestions((updateDto as any).updateQuestions);
        }

        // Apply updates (exclude customQuestions and updateQuestions from entity assignment)
        const { customQuestions, updateQuestions, ...entityData } = updateDto as any;
        Object.assign(matrix, entityData);

        // Re-validate settings if changed
        if (updateDto.settings) {
            await this.validateMatrix(updateDto.settings);
        }

        return await this.matrixRepository.save(matrix);
    }

    async remove(id: string): Promise<void> {
        const matrix = await this.findOne(id);

        // Check if this matrix is being used by any exam sessions
        const sessionsCount = await this.sessionRepository.count({
            where: { matrixId: id },
        });

        if (sessionsCount > 0) {
            throw new BadRequestException(`Không thể xóa ma trận đề "${matrix.name}". Đang được sử dụng bởi ${sessionsCount} ca thi.`);
        }

        await this.matrixRepository.remove(matrix);
    }
}
