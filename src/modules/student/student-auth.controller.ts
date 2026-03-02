/**
 * Controller xác thực cho Học sinh
 * Đăng nhập, đổi mật khẩu lần đầu, đổi mật khẩu, xem ca thi
 * Prefix: /student-auth
 */
import { Controller, Post, Body, Get, Param, UseGuards, Request, HttpCode, HttpStatus } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from "@nestjs/swagger";
import { StudentService } from "./student.service";
import { StudentLoginDto } from "./dto/student-login.dto";
import { StudentChangePasswordDto } from "./dto/student-change-password.dto";
import { StudentJwtAuthGuard } from "./guards/student-jwt-auth.guard";

@ApiTags("student-auth")
@Controller("student-auth")
export class StudentAuthController {
    constructor(private readonly studentService: StudentService) {}

    /** Học sinh đăng nhập bằng username/password */
    @Post("login")
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: "Học sinh đăng nhập" })
    @ApiResponse({ status: 200, description: "Đăng nhập thành công" })
    @ApiResponse({ status: 401, description: "Sai tài khoản hoặc mật khẩu" })
    async login(@Body() dto: StudentLoginDto) {
        return this.studentService.login(dto.username, dto.password);
    }

    /** Đổi mật khẩu lần đầu (bắt buộc) */
    @Post("force-change-password")
    @UseGuards(StudentJwtAuthGuard)
    @ApiBearerAuth("access-token")
    @ApiOperation({ summary: "Đổi mật khẩu lần đầu đăng nhập" })
    @ApiResponse({ status: 200, description: "Đổi mật khẩu thành công" })
    async forceChangePassword(@Request() req, @Body() dto: StudentChangePasswordDto) {
        return this.studentService.forceChangePassword(req.user.studentId, dto.newPassword);
    }

    /** Đổi mật khẩu (cần mật khẩu cũ) */
    @Post("change-password")
    @UseGuards(StudentJwtAuthGuard)
    @ApiBearerAuth("access-token")
    @ApiOperation({ summary: "Đổi mật khẩu" })
    @ApiResponse({ status: 200, description: "Đổi mật khẩu thành công" })
    async changePassword(@Request() req, @Body() body: { oldPassword: string; newPassword: string }) {
        return this.studentService.changePassword(req.user.studentId, body.oldPassword, body.newPassword);
    }

    /** Lấy thông tin học sinh hiện tại */
    @Get("profile")
    @UseGuards(StudentJwtAuthGuard)
    @ApiBearerAuth("access-token")
    @ApiOperation({ summary: "Lấy profile học sinh" })
    async getProfile(@Request() req) {
        return this.studentService.findOne(req.user.studentId);
    }

    /** Lấy danh sách ca thi của học sinh */
    @Get("my-exams")
    @UseGuards(StudentJwtAuthGuard)
    @ApiBearerAuth("access-token")
    @ApiOperation({ summary: "Danh sách ca thi của học sinh" })
    @ApiResponse({ status: 200, description: "Danh sách ca thi" })
    async getMyExams(@Request() req) {
        return this.studentService.getMyExamSessions(req.user.studentId);
    }

    /** Bắt đầu thi bằng JWT (thay thế access code) */
    @Post("exams/:studentExamId/start")
    @UseGuards(StudentJwtAuthGuard)
    @ApiBearerAuth("access-token")
    @ApiOperation({ summary: "Bắt đầu làm bài thi" })
    async startExam(@Request() req, @Param("studentExamId") studentExamId: string) {
        return this.studentService.startExamByJwt(req.user.studentId, studentExamId);
    }
}
