import { Controller, Get, Post, Body, Patch, Param, Delete, Query, HttpCode, HttpStatus, UseGuards, UseInterceptors, UploadedFile, Request } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { QuestionPoolService } from "./question-pool.service";
import { QuestionImportService } from "./services/question-import.service";
import { CreateQuestionPoolDto } from "./dto/create-question-pool.dto";
import { UpdateQuestionPoolDto } from "./dto/update-question-pool.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";

@ApiTags("question-pools")
@ApiBearerAuth("access-token")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN", "LECTURER", "HEAD_OF_DEPARTMENT")
@Controller("question-pools")
export class QuestionPoolController {
    constructor(
        private readonly questionPoolService: QuestionPoolService,
        private readonly questionImportService: QuestionImportService,
    ) {}

    @Post(":id/import-questions")
    @UseInterceptors(FileInterceptor("file"))
    async importQuestions(@Param("id") id: string, @UploadedFile() file: Express.Multer.File) {
        return this.questionImportService.importFromExcel(id, file.buffer);
    }

    /** Tạo bộ câu hỏi — gán người tạo + phân quyền isPublic */
    @Post()
    create(@Body() createQuestionPoolDto: CreateQuestionPoolDto, @Request() req) {
        return this.questionPoolService.create(createQuestionPoolDto, req.user.userId, req.user.role);
    }

    /** Lấy danh sách — lọc theo quyền xem của user */
    @Get()
    findAll(@Query("subjectId") subjectId: string, @Request() req) {
        return this.questionPoolService.findAll(req.user.userId, req.user.role, subjectId);
    }

    @Get(":id")
    findOne(@Param("id") id: string) {
        return this.questionPoolService.findOne(id);
    }

    @Get(":id/stats")
    async getStats(@Param("id") id: string) {
        const count = await this.questionPoolService.getQuestionCount(id);
        return { questionCount: count };
    }

    /** Cập nhật bộ câu hỏi — kiểm tra quyền sở hữu */
    @Patch(":id")
    update(@Param("id") id: string, @Body() updateQuestionPoolDto: UpdateQuestionPoolDto, @Request() req) {
        return this.questionPoolService.update(id, updateQuestionPoolDto, req.user.userId, req.user.role);
    }

    /** Xóa bộ câu hỏi — kiểm tra quyền sở hữu */
    @Delete(":id")
    @HttpCode(HttpStatus.NO_CONTENT)
    remove(@Param("id") id: string, @Request() req) {
        return this.questionPoolService.remove(id, req.user.userId, req.user.role);
    }
}
