import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, UseInterceptors, UploadedFile, Res, BadRequestException } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from "@nestjs/swagger";
import { Response } from "express";
import { DataSource } from "typeorm";
import * as bcrypt from "bcrypt";
import { AuthService } from "./auth.service";
import { CreateLecturerDto } from "./dto/create-lecturer.dto";
import { UpdateLecturerDto } from "./dto/update-lecturer.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { RolesGuard } from "./guards/roles.guard";
import { Roles } from "./decorators/roles.decorator";
import { TemplateGeneratorService } from "../../shared/services/template-generator.service";
import { User } from "./entities/user.entity";
import { Class } from "../class/entities/class.entity";
import { REGEX } from "src/constants";

@ApiTags("lecturers")
@Controller("lecturers")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
@ApiBearerAuth("access-token")
export class LecturerController {
    constructor(
        private readonly authService: AuthService,
        private readonly templateGeneratorService: TemplateGeneratorService,
        private readonly dataSource: DataSource,
    ) {}

    @Post()
    @ApiOperation({ summary: "Create a new lecturer (Admin only)" })
    @ApiResponse({ status: 201, description: "Lecturer created successfully" })
    @ApiResponse({ status: 401, description: "Unauthorized" })
    @ApiResponse({ status: 403, description: "Forbidden - Admin only" })
    async createLecturer(@Body() createLecturerDto: CreateLecturerDto) {
        const lecturer = await this.authService.createLecturer(createLecturerDto.fullName, createLecturerDto.email, createLecturerDto.phone);

        return {
            message: "Tạo tài khoản Giảng viên thành công",
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

    /** Tải mẫu file Excel import giảng viên */
    @Get("import-template")
    @ApiOperation({ summary: "Tải mẫu file Excel import giảng viên" })
    async downloadTemplate(@Res() res: Response) {
        const buffer = await this.templateGeneratorService.generate([
            {
                name: "Danh sách giảng viên",
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

    /** Import giảng viên từ file Excel */
    @Post("import-excel")
    @UseInterceptors(FileInterceptor("file"))
    @ApiOperation({ summary: "Import giảng viên từ file Excel" })
    async importExcel(@UploadedFile() file: Express.Multer.File) {
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
            message: `Import hoàn tất: ${rows.length}/${rows.length} giảng viên thành công`,
            defaultPassword: "123456789",
            total: rows.length,
            success: rows.length,
            failed: 0,
            errors: [],
        };
    }

    @Get()
    @ApiOperation({ summary: "Get all lecturers (Admin only)" })
    @ApiResponse({ status: 200, description: "List of lecturers" })
    async getAllLecturers() {
        return this.authService.getAllLecturers();
    }

    @Get(":id")
    @ApiOperation({ summary: "Get lecturer by ID (Admin only)" })
    @ApiResponse({ status: 200, description: "Lecturer details" })
    @ApiResponse({ status: 404, description: "Lecturer not found" })
    async getLecturerById(@Param("id") id: string) {
        const lecturer = await this.authService.getLecturerById(id);
        return {
            id: lecturer.id,
            fullName: lecturer.fullName,
            email: lecturer.email,
            phone: lecturer.phone,
            createdAt: lecturer.createdAt,
            updatedAt: lecturer.updatedAt,
        };
    }

    @Patch(":id")
    @ApiOperation({ summary: "Update lecturer (Admin only)" })
    @ApiResponse({ status: 200, description: "Lecturer updated successfully" })
    @ApiResponse({ status: 404, description: "Lecturer not found" })
    async updateLecturer(@Param("id") id: string, @Body() updateLecturerDto: UpdateLecturerDto) {
        const lecturer = await this.authService.updateLecturer(id, updateLecturerDto.fullName, updateLecturerDto.email, updateLecturerDto.phone);

        return {
            message: "Cập nhật thông tin Giảng viên thành công",
            lecturer: {
                id: lecturer.id,
                fullName: lecturer.fullName,
                email: lecturer.email,
                phone: lecturer.phone,
                updatedAt: lecturer.updatedAt,
            },
        };
    }

    @Delete(":id")
    @ApiOperation({ summary: "Delete lecturer (Admin only)" })
    @ApiResponse({ status: 200, description: "Lecturer deleted successfully" })
    @ApiResponse({ status: 404, description: "Lecturer not found" })
    async deleteLecturer(@Param("id") id: string) {
        await this.authService.deleteLecturer(id);
        return { message: "Xóa tài khoản Giảng viên thành công" };
    }

    @Post(":id/reset-password")
    @ApiOperation({ summary: "Reset lecturer password to default (Admin only)" })
    @ApiResponse({ status: 200, description: "Password reset successfully" })
    @ApiResponse({ status: 404, description: "Lecturer not found" })
    async resetPassword(@Param("id") id: string) {
        await this.authService.resetLecturerPassword(id);
        return {
            message: "Reset mật khẩu thành công",
            defaultPassword: "123456789",
        };
    }
}
