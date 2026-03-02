/**
 * Controller dành cho Tổ trưởng bộ môn (HOD)
 * Quản lý giáo viên: tạo, xem danh sách, reset mật khẩu
 * Prefix: /hod
 */
import { Body, Controller, Get, Post, Param, Delete, Patch, Request, UseGuards, UseInterceptors, UploadedFile, Res, BadRequestException } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Response } from "express";
import { DataSource } from "typeorm";
import * as bcrypt from "bcrypt";
import { AuthService } from "./auth.service";
import { Roles } from "./decorators/roles.decorator";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { RolesGuard } from "./guards/roles.guard";
import { CreateHeadOfDepartmentDto } from "./dto/head-of-department.dto";
import { HodCreateLecturerDto } from "./dto/hod-create-lecturer.dto";
import { UpdateLecturerDto } from "./dto/update-lecturer.dto";
import { ROLE, REGEX } from "src/constants";
import { TemplateGeneratorService } from "../../shared/services/template-generator.service";
import { User } from "./entities/user.entity";
import { Class } from "../class/entities/class.entity";

@ApiTags("hod")
@Controller("hod")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("access-token")
export class HodController {
    constructor(
        private readonly authService: AuthService,
        private readonly templateGeneratorService: TemplateGeneratorService,
        private readonly dataSource: DataSource,
    ) {}

    /* ============================
     * API quản lý HOD bởi Admin
     * ============================ */

    /** Admin tạo tài khoản Tổ trưởng bộ môn */
    @Post("create")
    @Roles(ROLE.ADMIN)
    @ApiOperation({ summary: "Tạo tài khoản Tổ trưởng bộ môn (Admin only)" })
    @ApiResponse({ status: 201, description: "Tạo thành công" })
    async createHod(@Body() dto: CreateHeadOfDepartmentDto) {
        const hod = await this.authService.createHeadOfDepartment(dto.fullName, dto.email, dto.phone);
        return {
            message: "Tạo tài khoản Tổ trưởng bộ môn thành công",
            defaultPassword: "123456789",
            headOfDepartment: {
                id: hod.id,
                fullName: hod.fullName,
                email: hod.email,
                phone: hod.phone,
                createdAt: hod.createdAt,
            },
        };
    }

    /** Admin lấy danh sách tất cả HOD */
    @Get("list")
    @Roles(ROLE.ADMIN)
    @ApiOperation({ summary: "Lấy danh sách Tổ trưởng bộ môn (Admin only)" })
    @ApiResponse({ status: 200, description: "Danh sách HOD" })
    async getAllHods() {
        return this.authService.getAllHeadOfDepartments();
    }

    /* ============================
     * API quản lý Giáo viên bởi HOD
     * (Đặt trước các route :id để NestJS match static path trước)
     * ============================ */

    /** HOD tạo tài khoản giáo viên */
    @Post("lecturers")
    @Roles(ROLE.HEAD_OF_DEPARTMENT)
    @ApiOperation({ summary: "HOD tạo tài khoản giáo viên" })
    @ApiResponse({ status: 201, description: "Tạo giáo viên thành công" })
    async createLecturer(@Body() dto: HodCreateLecturerDto) {
        const lecturer = await this.authService.createLecturer(dto.fullName, dto.email, dto.phone);
        return {
            message: "Tạo tài khoản Giáo viên thành công",
            defaultPassword: "123456789",
            lecturer: {
                id: lecturer.id,
                fullName: lecturer.fullName,
                email: lecturer.email,
                phone: lecturer.phone,
                createdAt: lecturer.createdAt,
            },
        };
    }

    /** HOD tải mẫu file Excel import giáo viên */
    @Get("lecturers/import-template")
    @Roles(ROLE.HEAD_OF_DEPARTMENT)
    @ApiOperation({ summary: "HOD tải mẫu file Excel import giáo viên" })
    async downloadLecturerTemplate(@Res() res: Response) {
        const buffer = await this.templateGeneratorService.generate([
            {
                name: "Danh sách giáo viên",
                columns: [
                    { header: "Họ tên", key: "fullName", width: 25, required: true, note: "VD: Nguyễn Văn A" },
                    { header: "Email", key: "email", width: 30, required: true, note: "VD: nguyenvana@school.edu.vn" },
                    { header: "SĐT", key: "phone", width: 18, required: false, note: "VD: 0901234567" },
                    { header: "Lớp phụ trách", key: "className", width: 20, required: false, note: "VD: 10A1 (tự gán nếu lớp tồn tại)" },
                ],
                sampleRows: [
                    { fullName: "Nguyễn Văn A", email: "nguyenvana@school.edu.vn", phone: "0901234567", className: "10A1" },
                    { fullName: "Trần Thị B", email: "tranthib@school.edu.vn", phone: "", className: "" },
                ],
            },
        ]);
        res.set({
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": 'attachment; filename="mau_import_giang_vien.xlsx"',
        });
        res.end(buffer);
    }

    /** HOD import giáo viên từ file Excel */
    @Post("lecturers/import-excel")
    @Roles(ROLE.HEAD_OF_DEPARTMENT)
    @UseInterceptors(FileInterceptor("file"))
    @ApiOperation({ summary: "HOD import giáo viên từ file Excel" })
    async importLecturerExcel(@UploadedFile() file: Express.Multer.File) {
        if (!file) throw new BadRequestException("Vui lòng chọn file Excel");

        const ExcelJS = await import("exceljs");
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(file.buffer as any);

        const sheet = workbook.worksheets[0];
        if (!sheet) throw new BadRequestException("File Excel không có sheet nào");

        // Phase 1: Parse all rows
        const rows: { fullName: string; email: string; phone?: string; className?: string; rowIdx: number }[] = [];
        for (let rowIdx = 3; rowIdx <= sheet.rowCount; rowIdx++) {
            const row = sheet.getRow(rowIdx);
            const fullName = row.getCell(1).value?.toString().trim();
            const email = row.getCell(2).value?.toString().trim();
            if (!fullName || !email) continue;
            const phone = row.getCell(3).value?.toString().trim() || undefined;
            const className = row.getCell(4).value?.toString().trim() || undefined;
            rows.push({ fullName, email, phone, className, rowIdx });
        }

        if (rows.length === 0) throw new BadRequestException("Không tìm thấy dữ liệu hợp lệ trong file");

        // Phase 2: Pre-validate
        const errors: string[] = [];
        const emailSet = new Set<string>();
        const phoneSet = new Set<string>();
        const userRepo = this.dataSource.getRepository(User);

        for (const r of rows) {
            if (!REGEX.EMAIL.test(r.email)) {
                errors.push(`Dòng ${r.rowIdx}: Email "${r.email}" không hợp lệ`);
                continue;
            }

            if (emailSet.has(r.email)) {
                errors.push(`Dòng ${r.rowIdx}: Email ${r.email} trùng trong file`);
                continue;
            }
            emailSet.add(r.email);

            if (r.phone) {
                if (phoneSet.has(r.phone)) {
                    errors.push(`Dòng ${r.rowIdx}: SĐT ${r.phone} trùng trong file`);
                    continue;
                }
                phoneSet.add(r.phone);
            }

            const existingEmail = await userRepo.findOne({ where: { email: r.email } });
            if (existingEmail) {
                errors.push(`Dòng ${r.rowIdx}: Email ${r.email} đã tồn tại trong hệ thống`);
                continue;
            }

            if (r.phone) {
                const existingPhone = await userRepo.findOne({ where: { phone: r.phone } });
                if (existingPhone) {
                    errors.push(`Dòng ${r.rowIdx}: SĐT ${r.phone} đã tồn tại trong hệ thống`);
                    continue;
                }
            }

            // Validate class exists if provided
            if (r.className) {
                const classRepo = this.dataSource.getRepository(Class);
                const classEntity = await classRepo.findOne({ where: { name: r.className } });
                if (!classEntity) {
                    errors.push(`Dòng ${r.rowIdx}: Lớp "${r.className}" không tồn tại trong hệ thống`);
                    continue;
                }
            }
        }

        if (errors.length > 0) {
            throw new BadRequestException({
                message: `Import thất bại: ${errors.length}/${rows.length} dòng lỗi`,
                errors,
            });
        }

        // Phase 3: Insert all in transaction (rollback if any error)
        await this.dataSource.transaction(async (manager) => {
            const txUserRepo = manager.getRepository(User);
            const txClassRepo = manager.getRepository(Class);

            for (const r of rows) {
                const hashedPassword = await bcrypt.hash("123456789", 10);
                const lecturer = txUserRepo.create({
                    username: r.email,
                    email: r.email,
                    phone: r.phone,
                    password: hashedPassword,
                    fullName: r.fullName,
                    role: "LECTURER",
                    isFirstLogin: true,
                });
                const saved = await txUserRepo.save(lecturer);

                // Assign to class if className provided and class exists
                if (r.className) {
                    const classEntity = await txClassRepo.findOne({
                        where: { name: r.className },
                        relations: ["lecturers"],
                    });
                    if (classEntity) {
                        classEntity.lecturers.push(saved);
                        await txClassRepo.save(classEntity);
                    }
                }
            }
        });

        return {
            message: `Import hoàn tất: ${rows.length}/${rows.length} giáo viên thành công`,
            defaultPassword: "123456789",
            total: rows.length,
            success: rows.length,
            failed: 0,
            errors: [],
        };
    }

    /** HOD lấy danh sách tất cả giáo viên */
    @Get("lecturers")
    @Roles(ROLE.HEAD_OF_DEPARTMENT)
    @ApiOperation({ summary: "HOD lấy danh sách giáo viên" })
    @ApiResponse({ status: 200, description: "Danh sách giáo viên" })
    async getAllLecturers() {
        return this.authService.getAllLecturers();
    }

    /** HOD cập nhật thông tin giáo viên */
    @Patch("lecturers/:id")
    @Roles(ROLE.HEAD_OF_DEPARTMENT)
    @ApiOperation({ summary: "HOD cập nhật thông tin giáo viên" })
    @ApiResponse({ status: 200, description: "Cập nhật thành công" })
    async updateLecturer(@Param("id") id: string, @Body() dto: UpdateLecturerDto) {
        const lecturer = await this.authService.updateLecturer(id, dto.fullName, dto.email, dto.phone);
        return {
            message: "Cập nhật thông tin Giáo viên thành công",
            lecturer: {
                id: lecturer.id,
                fullName: lecturer.fullName,
                email: lecturer.email,
                phone: lecturer.phone,
                updatedAt: lecturer.updatedAt,
            },
        };
    }

    /** HOD xóa giáo viên */
    @Delete("lecturers/:id")
    @Roles(ROLE.HEAD_OF_DEPARTMENT)
    @ApiOperation({ summary: "HOD xóa giáo viên" })
    @ApiResponse({ status: 200, description: "Xóa thành công" })
    async deleteLecturer(@Param("id") id: string) {
        await this.authService.deleteLecturer(id);
        return { message: "Xóa tài khoản Giáo viên thành công" };
    }

    /** HOD reset mật khẩu giáo viên */
    @Post("lecturers/:id/reset-password")
    @Roles(ROLE.HEAD_OF_DEPARTMENT)
    @ApiOperation({ summary: "HOD reset mật khẩu giáo viên" })
    @ApiResponse({ status: 200, description: "Reset mật khẩu thành công" })
    async resetLecturerPassword(@Param("id") id: string) {
        await this.authService.resetLecturerPassword(id);
        return {
            message: "Reset mật khẩu thành công",
            defaultPassword: "123456789",
        };
    }

    /* ============================
     * API quản lý HOD bởi Admin (dynamic :id routes)
     * ============================ */

    /** Admin lấy chi tiết HOD theo ID */
    @Get(":id")
    @Roles(ROLE.ADMIN)
    @ApiOperation({ summary: "Lấy chi tiết Tổ trưởng bộ môn (Admin only)" })
    @ApiResponse({ status: 200, description: "Chi tiết HOD" })
    async getHodById(@Param("id") id: string) {
        const hod = await this.authService.getHodById(id);
        return {
            id: hod.id,
            fullName: hod.fullName,
            email: hod.email,
            phone: hod.phone,
            createdAt: hod.createdAt,
            updatedAt: hod.updatedAt,
        };
    }

    /** Admin cập nhật thông tin HOD */
    @Patch(":id")
    @Roles(ROLE.ADMIN)
    @ApiOperation({ summary: "Cập nhật Tổ trưởng bộ môn (Admin only)" })
    @ApiResponse({ status: 200, description: "Cập nhật thành công" })
    async updateHod(@Param("id") id: string, @Body() dto: CreateHeadOfDepartmentDto) {
        const hod = await this.authService.updateHod(id, dto.fullName, dto.email, dto.phone);
        return {
            message: "Cập nhật thông tin Tổ trưởng bộ môn thành công",
            headOfDepartment: {
                id: hod.id,
                fullName: hod.fullName,
                email: hod.email,
                phone: hod.phone,
                updatedAt: hod.updatedAt,
            },
        };
    }

    /** Admin xóa tài khoản HOD */
    @Delete(":id")
    @Roles(ROLE.ADMIN)
    @ApiOperation({ summary: "Xóa Tổ trưởng bộ môn (Admin only)" })
    @ApiResponse({ status: 200, description: "Xóa thành công" })
    async deleteHod(@Param("id") id: string) {
        await this.authService.deleteHod(id);
        return { message: "Xóa tài khoản Tổ trưởng bộ môn thành công" };
    }

    /** Admin reset mật khẩu HOD */
    @Post(":id/reset-password")
    @Roles(ROLE.ADMIN)
    @ApiOperation({ summary: "Reset mật khẩu Tổ trưởng bộ môn (Admin only)" })
    @ApiResponse({ status: 200, description: "Reset mật khẩu thành công" })
    async resetHodPassword(@Param("id") id: string) {
        await this.authService.resetHodPassword(id);
        return {
            message: "Reset mật khẩu thành công",
            defaultPassword: "123456789",
        };
    }
}
