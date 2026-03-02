/**
 * Controller thống kê dành cho Tổ trưởng bộ môn (HOD)
 * Endpoints: dashboard stats, lecturer-class stats, exam session stats
 */
import { Controller, Get, Request, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from "@nestjs/swagger";
import { HodStatisticsService } from "./hod-statistics.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { ROLE } from "src/constants";

@ApiTags("hod-statistics")
@Controller("hod/statistics")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLE.HEAD_OF_DEPARTMENT)
@ApiBearerAuth("access-token")
export class HodStatisticsController {
    constructor(private readonly hodStatisticsService: HodStatisticsService) {}

    /** Lấy thống kê tổng quan cho HOD Dashboard */
    @Get("dashboard")
    @ApiOperation({ summary: "Thống kê tổng quan HOD" })
    @ApiResponse({ status: 200, description: "Dữ liệu thống kê" })
    async getDashboardStats(@Request() req) {
        return this.hodStatisticsService.getDashboardStats(req.user.userId);
    }

    /** Lấy thống kê giáo viên - lớp phụ trách */
    @Get("lecturer-classes")
    @ApiOperation({ summary: "Thống kê giáo viên theo lớp" })
    @ApiResponse({ status: 200, description: "Danh sách GV kèm lớp phụ trách" })
    async getLecturerClassStats(@Request() req) {
        return this.hodStatisticsService.getLecturerClassStats(req.user.userId);
    }

    /** Lấy thống kê ca thi */
    @Get("exam-sessions")
    @ApiOperation({ summary: "Thống kê ca thi" })
    @ApiResponse({ status: 200, description: "Danh sách ca thi kèm thống kê" })
    async getExamSessionStats() {
        return this.hodStatisticsService.getExamSessionStats();
    }

    /** Lấy dữ liệu biểu đồ điểm trung bình */
    @Get("score-chart")
    @ApiOperation({ summary: "Dữ liệu biểu đồ điểm" })
    @ApiResponse({ status: 200, description: "Dữ liệu biểu đồ" })
    async getScoreChartData() {
        return this.hodStatisticsService.getScoreChartData();
    }
}
