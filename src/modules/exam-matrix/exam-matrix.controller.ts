import { Controller, Get, Post, Body, Patch, Param, Delete, HttpCode, HttpStatus, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { ExamMatrixService } from "./exam-matrix.service";
import { CreateExamMatrixDto } from "./dto/create-exam-matrix.dto";
import { UpdateExamMatrixDto } from "./dto/update-exam-matrix.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";

@ApiTags("exam-matrices")
@ApiBearerAuth("access-token")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN", "LECTURER", "HEAD_OF_DEPARTMENT")
@Controller("exam-matrices")
export class ExamMatrixController {
    constructor(private readonly examMatrixService: ExamMatrixService) {}

    @Post()
    create(@Body() createDto: CreateExamMatrixDto) {
        return this.examMatrixService.create(createDto);
    }

    @Get()
    findAll() {
        return this.examMatrixService.findAll();
    }

    @Get(":id")
    findOne(@Param("id") id: string) {
        return this.examMatrixService.findOne(id);
    }

    @Get(":id/fixed-questions")
    getFixedQuestions(@Param("id") id: string) {
        return this.examMatrixService.getFixedQuestions(id);
    }

    @Patch(":id")
    update(@Param("id") id: string, @Body() updateDto: UpdateExamMatrixDto) {
        return this.examMatrixService.update(id, updateDto);
    }

    @Delete(":id")
    @HttpCode(HttpStatus.NO_CONTENT)
    remove(@Param("id") id: string) {
        return this.examMatrixService.remove(id);
    }
}
