import { Controller, Post, Body, Param, Get, Patch, HttpCode, HttpStatus, UseGuards, Request } from "@nestjs/common";
import { StudentExamService } from "./student-exam.service";
import { StudentAnswers } from "./interfaces/exam-snapshot.interface";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";

@Controller("student-exams")
export class StudentExamController {
    constructor(private readonly studentExamService: StudentExamService) {}

    @Post(":id/start")
    async startExam(@Param("id") id: string) {
        return await this.studentExamService.startExam(id);
    }

    @Post(":id/submit")
    async submitExam(@Param("id") id: string, @Body() answers: StudentAnswers) {
        return await this.studentExamService.submitExam(id, answers);
    }

    @Get(":id/result")
    async getResult(@Param("id") id: string) {
        return await this.studentExamService.getResult(id);
    }

    @Patch(":id/update-score")
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles("LECTURER")
    async updateScore(@Param("id") id: string, @Body("score") score: number, @Request() req) {
        return await this.studentExamService.updateScore(id, score, req.user?.userId, req.user?.role);
    }
}
