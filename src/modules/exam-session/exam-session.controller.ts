import { Controller, Get, Post, Body, Patch, Param, Delete, HttpCode, HttpStatus, UseGuards, Res, Request } from "@nestjs/common";
import { Response } from "express";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { ExamSessionService } from "./exam-session.service";
import { CreateExamSessionDto } from "./dto/create-exam-session.dto";
import { UpdateExamSessionDto } from "./dto/update-exam-session.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";

@ApiTags("exam-sessions")
@ApiBearerAuth("access-token")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN", "LECTURER", "HEAD_OF_DEPARTMENT")
@Controller("exam-sessions")
export class ExamSessionController {
    constructor(private readonly examSessionService: ExamSessionService) {}

    @Post()
    create(@Body() createDto: CreateExamSessionDto, @Request() req) {
        return this.examSessionService.create(createDto, req.user?.userId);
    }

    @Get()
    findAll() {
        return this.examSessionService.findAll();
    }

    @Get(":id")
    findOne(@Param("id") id: string) {
        return this.examSessionService.findOne(id);
    }

    @Get(":id/students")
    getStudents(@Param("id") id: string) {
        return this.examSessionService.getStudentsInSession(id);
    }

    /** Lấy danh sách ca thi tương đương (cùng ma trận đề) */
    @Get(":id/equivalent-sessions")
    getEquivalentSessions(@Param("id") id: string) {
        return this.examSessionService.getEquivalentSessions(id);
    }

    /** Chuyển HS vắng thi sang ca thi đích */
    @Post(":id/transfer-student")
    transferStudent(@Param("id") targetSessionId: string, @Body() body: { studentExamId: string }) {
        return this.examSessionService.transferStudent(targetSessionId, body.studentExamId);
    }

    @Patch(":id")
    update(@Param("id") id: string, @Body() updateDto: UpdateExamSessionDto) {
        return this.examSessionService.update(id, updateDto);
    }

    @Delete(":id")
    @HttpCode(HttpStatus.NO_CONTENT)
    remove(@Param("id") id: string) {
        return this.examSessionService.remove(id);
    }
}
