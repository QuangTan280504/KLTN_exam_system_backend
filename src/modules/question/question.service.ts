import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { v4 as uuidv4 } from "uuid";
import { Question } from "./entities/question.entity";
import { CreateQuestionDto, MCQDataDto, GroupDataDto, ShortAnswerDataDto } from "./dto/create-question.dto";
import { UpdateQuestionDto } from "./dto/update-question.dto";
import { ExcelImportService } from "./services/excel-import.service";
import { QuestionType, CognitiveLevel, MCQData, GroupData, ShortAnswerData, MCQOption } from "./interfaces/question-data.interface";

@Injectable()
export class QuestionService {
    constructor(
        @InjectRepository(Question)
        private questionRepository: Repository<Question>,
        private excelImportService: ExcelImportService,
        private dataSource: DataSource,
    ) {}

    async create(createQuestionDto: CreateQuestionDto): Promise<Question> {
        const { questionType, data, images, ...rest } = createQuestionDto;

        const processedData = this.processQuestionData(questionType, data);

        const question = this.questionRepository.create({
            ...rest,
            questionType,
            data: processedData,
            images: images || [],
        });

        return await this.questionRepository.save(question);
    }

    async findByPool(poolId: string, questionType?: QuestionType, cognitiveLevel?: CognitiveLevel, page: number = 1, limit: number = 10): Promise<{ items: Question[]; total: number; page: number; limit: number }> {
        const queryBuilder = this.questionRepository.createQueryBuilder("q");
        queryBuilder.where("q.pool_id = :poolId", { poolId });

        if (questionType) {
            queryBuilder.andWhere("q.question_type = :questionType", { questionType });
        }

        if (cognitiveLevel) {
            queryBuilder.andWhere("q.cognitive_level = :cognitiveLevel", {
                cognitiveLevel,
            });
        }

        const total = await queryBuilder.getCount();
        const items = await queryBuilder
            .skip((page - 1) * limit)
            .take(limit)
            .orderBy("q.created_at", "DESC")
            .getMany();

        return { items, total, page, limit };
    }

    async findRandomByPool(poolId: string, count: number, questionType?: QuestionType, cognitiveLevel?: CognitiveLevel): Promise<Question[]> {
        const queryBuilder = this.questionRepository.createQueryBuilder("q");
        queryBuilder.where("q.pool_id = :poolId", { poolId });

        if (questionType) {
            queryBuilder.andWhere("q.question_type = :questionType", { questionType });
        }

        if (cognitiveLevel) {
            queryBuilder.andWhere("q.cognitive_level = :cognitiveLevel", {
                cognitiveLevel,
            });
        }

        queryBuilder.orderBy("RANDOM()").limit(count);

        return await queryBuilder.getMany();
    }

    async findOne(id: string): Promise<Question> {
        const question = await this.questionRepository.findOne({ where: { id } });
        if (!question) {
            throw new NotFoundException(`Question with ID ${id} not found`);
        }
        return question;
    }

    async update(id: string, updateQuestionDto: UpdateQuestionDto): Promise<Question> {
        const question = await this.findOne(id);
        const { questionType, data, images, ...rest } = updateQuestionDto;

        if (data) {
            const type = questionType || question.questionType;
            question.data = this.processQuestionData(type, data);
        }

        if (images !== undefined) {
            question.images = images;
        }

        Object.assign(question, rest);
        return await this.questionRepository.save(question);
    }

    private processQuestionData(type: QuestionType, data: MCQDataDto | GroupDataDto | ShortAnswerDataDto): MCQData | GroupData | ShortAnswerData {
        if (type === QuestionType.MCQ) {
            const mcqData = data as MCQDataDto;
            // Generate UUIDs for options and map correct label to ID
            const optionsWithIds: MCQOption[] = mcqData.options.map((opt) => ({
                ...opt,
                id: uuidv4(),
            }));

            const correctOption = optionsWithIds.find((opt) => opt.label === mcqData.correctLabel);

            if (!correctOption) {
                throw new BadRequestException("Correct answer label not found in options");
            }

            return {
                options: optionsWithIds,
                correct_option_id: correctOption.id,
            } as MCQData;
        } else if (type === QuestionType.GROUP) {
            const groupData = data as GroupDataDto;
            // Generate UUIDs for sub-questions
            return {
                sub_questions: groupData.sub_questions.map((sub) => ({
                    ...sub,
                    id: uuidv4(),
                })),
            } as GroupData;
        } else {
            // SHORT_ANSWER: pass through, no special processing needed
            return data as ShortAnswerData;
        }
    }

    async remove(id: string): Promise<void> {
        const question = await this.findOne(id);
        await this.questionRepository.remove(question);
    }

    async importFromExcel(poolId: string, file: Express.Multer.File): Promise<any> {
        const parsed = await this.excelImportService.parseExcelFile(file.buffer);

        const errors: string[] = [];
        const results = {
            mcq: { total: parsed.mcqQuestions.length, success: 0, failed: 0 },
            group: { total: parsed.groupQuestions.length, success: 0, failed: 0 },
            shortAnswer: { total: parsed.shortAnswerQuestions.length, success: 0, failed: 0 },
        };

        // Insert all questions in a transaction (rollback if any error)
        await this.dataSource.transaction(async (manager) => {
            const txQuestionRepo = manager.getRepository(Question);

            for (let i = 0; i < parsed.mcqQuestions.length; i++) {
                const mcqQ = parsed.mcqQuestions[i];
                try {
                    const question = txQuestionRepo.create({
                        poolId,
                        questionType: QuestionType.MCQ,
                        content: mcqQ.content,
                        cognitiveLevel: mcqQ.cognitiveLevel,
                        data: mcqQ.data,
                        images: mcqQ.images || [],
                    });
                    await txQuestionRepo.save(question);
                    results.mcq.success++;
                } catch (error) {
                    errors.push(`MCQ #${i + 1}: ${error.message}`);
                    results.mcq.failed++;
                }
            }

            for (let i = 0; i < parsed.groupQuestions.length; i++) {
                const groupQ = parsed.groupQuestions[i];
                try {
                    const question = txQuestionRepo.create({
                        poolId,
                        questionType: QuestionType.GROUP,
                        content: groupQ.content,
                        cognitiveLevel: groupQ.cognitiveLevel,
                        data: groupQ.data,
                        images: groupQ.images || [],
                    });
                    await txQuestionRepo.save(question);
                    results.group.success++;
                } catch (error) {
                    errors.push(`Group #${i + 1}: ${error.message}`);
                    results.group.failed++;
                }
            }

            for (let i = 0; i < parsed.shortAnswerQuestions.length; i++) {
                const saQ = parsed.shortAnswerQuestions[i];
                try {
                    const question = txQuestionRepo.create({
                        poolId,
                        questionType: QuestionType.SHORT_ANSWER,
                        content: saQ.content,
                        cognitiveLevel: saQ.cognitiveLevel,
                        data: saQ.data,
                        images: saQ.images || [],
                    });
                    await txQuestionRepo.save(question);
                    results.shortAnswer.success++;
                } catch (error) {
                    errors.push(`Short Answer #${i + 1}: ${error.message}`);
                    results.shortAnswer.failed++;
                }
            }

            if (errors.length > 0) {
                const total = results.mcq.total + results.group.total + results.shortAnswer.total;
                throw new BadRequestException({
                    message: `Import thất bại: ${errors.length}/${total} câu hỏi lỗi. Đã rollback toàn bộ`,
                    errors,
                });
            }
        });

        return results;
    }
}
