import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { QuestionPool } from "./entities/question-pool.entity";
import { ExamMatrix } from "../exam-matrix/entities/exam-matrix.entity";
import { CreateQuestionPoolDto } from "./dto/create-question-pool.dto";
import { UpdateQuestionPoolDto } from "./dto/update-question-pool.dto";
import { QuestionType } from "../question/interfaces/question-data.interface";
import { ROLE } from "../../utils/role";

@Injectable()
export class QuestionPoolService {
    constructor(
        @InjectRepository(QuestionPool)
        private questionPoolRepository: Repository<QuestionPool>,
        @InjectRepository(ExamMatrix)
        private matrixRepository: Repository<ExamMatrix>,
    ) {}

    /**
     * Tạo bộ câu hỏi mới.
     * - GV (LECTURER): luôn isPublic = false (bộ câu hỏi riêng)
     * - HOD / ADMIN: cho phép chọn isPublic
     */
    async create(createQuestionPoolDto: CreateQuestionPoolDto, userId: string, userRole: string): Promise<QuestionPool> {
        const poolData: Partial<QuestionPool> = {
            ...createQuestionPoolDto,
            createdById: userId,
        };

        // GV không được tạo bộ câu hỏi dùng chung
        if (userRole === ROLE.LECTURER) {
            poolData.isPublic = false;
        } else {
            poolData.isPublic = createQuestionPoolDto.isPublic ?? false;
        }

        const pool = this.questionPoolRepository.create(poolData);
        return await this.questionPoolRepository.save(pool);
    }

    /**
     * Lấy danh sách bộ câu hỏi theo quyền:
     * - LECTURER / HOD: chỉ thấy pool chung (isPublic) + pool riêng của mình
     * - ADMIN: thấy tất cả
     * Có thể lọc thêm theo subjectId
     */
    async findAll(userId: string, userRole: string, subjectId?: string): Promise<QuestionPool[]> {
        // Xây dựng mảng điều kiện where (mỗi phần tử = OR)
        const whereConditions: any[] = [];

        if (userRole === ROLE.LECTURER || userRole === ROLE.HEAD_OF_DEPARTMENT) {
            // GV và HOD: chỉ thấy pool chung + pool riêng của mình
            const publicFilter: any = { isPublic: true };
            const ownFilter: any = { createdById: userId };

            if (subjectId) {
                publicFilter.subjectId = subjectId;
                ownFilter.subjectId = subjectId;
            }

            whereConditions.push(publicFilter, ownFilter);
        } else {
            // ADMIN: thấy tất cả
            if (subjectId) {
                whereConditions.push({ subjectId });
            }
        }

        return await this.questionPoolRepository.find({
            where: whereConditions.length > 0 ? whereConditions : undefined,
            relations: ["subject", "createdBy"],
            order: { isPublic: "DESC" as any, name: "ASC" },
        });
    }

    async findOne(id: string): Promise<QuestionPool> {
        const pool = await this.questionPoolRepository.findOne({
            where: { id },
            relations: ["subject", "createdBy"],
        });
        if (!pool) {
            throw new NotFoundException(`Question Pool with ID ${id} not found`);
        }
        return pool;
    }

    /**
     * Cập nhật bộ câu hỏi — kiểm tra quyền sở hữu.
     * - LECTURER: chỉ sửa pool do mình tạo
     * - HOD: sửa pool chung + pool riêng của mình
     * - ADMIN: sửa tất cả
     */
    async update(id: string, updateQuestionPoolDto: UpdateQuestionPoolDto, userId: string, userRole: string): Promise<QuestionPool> {
        const pool = await this.findOne(id);
        this.checkOwnership(pool, userId, userRole, "sửa");

        // GV không được đổi thành public
        if (userRole === ROLE.LECTURER && updateQuestionPoolDto.isPublic) {
            throw new ForbiddenException("Giáo viên không có quyền đặt bộ câu hỏi dùng chung");
        }

        Object.assign(pool, updateQuestionPoolDto);
        return await this.questionPoolRepository.save(pool);
    }

    /**
     * Xóa bộ câu hỏi — kiểm tra quyền sở hữu + đang dùng trong ma trận đề.
     */
    async remove(id: string, userId: string, userRole: string): Promise<void> {
        const pool = await this.findOne(id);
        this.checkOwnership(pool, userId, userRole, "xóa");

        // Kiểm tra pool đang được dùng trong ma trận đề
        const matricesCount = await this.matrixRepository
            .createQueryBuilder("matrix")
            .where("matrix.settings ::text LIKE :poolId", { poolId: `%${id}%` })
            .getCount();

        if (matricesCount > 0) {
            throw new BadRequestException(`Không thể xóa gói câu hỏi "${pool.name}". Đang được sử dụng trong ${matricesCount} ma trận đề.`);
        }

        await this.questionPoolRepository.remove(pool);
    }

    /**
     * Kiểm tra quyền sở hữu pool.
     * - ADMIN: luôn được phép
     * - HOD: chỉ pool do mình tạo (bao gồm pool chung do mình tạo)
     * - LECTURER: chỉ pool do mình tạo
     * → Cả HOD lẫn GV đều không sửa/xóa được pool của người khác
     */
    private checkOwnership(pool: QuestionPool, userId: string, userRole: string, action: string): void {
        if (userRole === ROLE.ADMIN) return;

        // HOD và LECTURER: chỉ được thao tác pool do mình tạo
        if (pool.createdById !== userId) {
            throw new ForbiddenException(`Bạn không có quyền ${action} bộ câu hỏi này`);
        }
    }

    async getQuestionCount(poolId: string, type?: string, level?: number): Promise<number> {
        const query = this.questionPoolRepository.createQueryBuilder("pool").leftJoin("pool.questions", "question").where("pool.id = :poolId", { poolId });

        if (type) {
            query.andWhere("question.questionType = :type", { type });
        }

        if (level) {
            query.andWhere("question.cognitiveLevel = :level", { level });
        }

        const result = await query.select("COUNT(question.id)", "count").getRawOne();

        return parseInt(result.count, 10);
    }
}
