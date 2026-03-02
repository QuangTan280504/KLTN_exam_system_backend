import { Controller, Get, Param, Res, HttpStatus, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { Response } from "express";
import { ReportService } from "./report.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";

@ApiTags("reports")
@ApiBearerAuth("access-token")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN", "LECTURER", "HEAD_OF_DEPARTMENT")
@Controller("reports")
export class ReportController {
    constructor(private readonly reportService: ReportService) {}

    @Get("dashboard-stats")
    async getDashboardStats() {
        return this.reportService.getDashboardStats();
    }

    @Get("sessions/:id/score-sheet")
    async downloadScoreSheet(@Param("id") id: string, @Res() res: Response) {
        const { buffer, fileName } = await this.reportService.exportScoreSheet(id);

        res.set({
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": `attachment; filename="${fileName}"`,
            "Content-Length": buffer.length,
            "Cache-Control": "no-store, no-cache, must-revalidate",
            Pragma: "no-cache",
        });

        res.status(HttpStatus.OK).send(buffer);
    }

    @Get("sessions/:id/audit-log")
    async downloadAuditLog(@Param("id") id: string, @Res() res: Response) {
        const { buffer, fileName } = await this.reportService.exportAuditLog(id);

        res.set({
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": `attachment; filename="${fileName}"`,
            "Content-Length": buffer.length,
            "Cache-Control": "no-store, no-cache, must-revalidate",
            Pragma: "no-cache",
        });

        res.status(HttpStatus.OK).send(buffer);
    }
    @Get("student-exams/:id/detail")
    async getStudentExamDetail(@Param("id") id: string) {
        return this.reportService.getStudentExamDetail(id);
    }

    @Get("student-exams/:id/download")
    async downloadStudentExamDetail(@Param("id") id: string, @Res() res: Response) {
        const { buffer, fileName } = await this.reportService.exportStudentExamDetail(id);

        res.set({
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": `attachment; filename="${fileName}"`,
            "Content-Length": buffer.length,
            "Cache-Control": "no-store, no-cache, must-revalidate",
            Pragma: "no-cache",
        });

        res.status(HttpStatus.OK).send(buffer);
    }
}
