/**
 * Controller quản lý lớp học dành cho Tổ trưởng bộ môn (HOD)
 * Các endpoint CRUD lớp học + gán giáo viên
 */
import { Controller, Get, Post, Patch, Delete, Body, Param, Request, UseGuards, UseInterceptors, UploadedFile, Res, BadRequestException } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from "@nestjs/swagger";
import { Response } from "express";
import { DataSource } from "typeorm";
import { ClassService } from "./class.service";
import { CreateClassDto } from "./dto/create-class.dto";
import { UpdateClassDto } from "./dto/update-class.dto";
import { AssignLecturersDto } from "./dto/assign-lecturers.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { ROLE } from "src/constants";
import { TemplateGeneratorService } from "../../shared/services/template-generator.service";
import { Class } from "./entities/class.entity";

@ApiTags("classes")
@Controller("classes")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("access-token")
export class ClassController {
    constructor(
        private readonly classService: ClassService,
        private readonly templateGeneratorService: TemplateGeneratorService,
        private readonly dataSource: DataSource,
    ) {}

    /** Lấy danh sách lớp mà giáo viên đang đăng nhập được phân công */
    @Get("my-classes")
    @Roles(ROLE.LECTURER, ROLE.HEAD_OF_DEPARTMENT, ROLE.ADMIN)
    @ApiOperation({ summary: "Lấy danh sách lớp được phân công (GV/HOD/Admin)" })
    @ApiResponse({ status: 200, description: "Danh sách lớp được phân công" })
    async findMyClasses(@Request() req) {
        // Giảng viên → chỉ thấy lớp được gán
        if (req.user.role === ROLE.LECTURER) {
            return this.classService.findByLecturer(req.user.userId);
        }
        // HOD → lớp mình tạo
        if (req.user.role === ROLE.HEAD_OF_DEPARTMENT) {
            return this.classService.findAllByHod(req.user.userId);
        }
        // Admin → tất cả
        return this.classService.findAll();
    }

    /** Tạo lớp học mới (HOD) */
    @Post()
    @Roles(ROLE.HEAD_OF_DEPARTMENT)
    @ApiOperation({ summary: "Tạo lớp học mới (HOD)" })
    @ApiResponse({ status: 201, description: "Tạo lớp học thành công" })
    async create(@Body() createClassDto: CreateClassDto, @Request() req) {
        const classEntity = await this.classService.create(createClassDto, req.user.userId);
        return {
            message: "Tạo lớp học thành công",
            class: classEntity,
        };
    }

    /** Tải mẫu file Excel import lớp học */
    @Get("import-template")
    @Roles(ROLE.HEAD_OF_DEPARTMENT, ROLE.ADMIN)
    @ApiOperation({ summary: "Tải mẫu file Excel import lớp học" })
    async downloadTemplate(@Res() res: Response) {
        const buffer = await this.templateGeneratorService.generate([
            {
                name: "Danh sách lớp",
                columns: [
                    { header: "Tên lớp", key: "name", width: 20, required: true, note: "VD: 10A1" },
                    { header: "Khối", key: "grade", width: 12, required: false, note: "VD: 10" },
                    { header: "Mô tả", key: "description", width: 35, required: false, note: "VD: Lớp chuyên Toán" },
                ],
                sampleRows: [
                    { name: "10A1", grade: "10", description: "Lớp chuyên Toán" },
                    { name: "11B2", grade: "11", description: "" },
                    { name: "12C3", grade: "12", description: "Lớp chuyên Văn" },
                ],
            },
        ]);
        res.set({
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": 'attachment; filename="mau_import_lop_hoc.xlsx"',
        });
        res.end(buffer);
    }

    /** Import lớp học từ file Excel */
    @Post("import-excel")
    @Roles(ROLE.HEAD_OF_DEPARTMENT)
    @UseInterceptors(FileInterceptor("file"))
    @ApiOperation({ summary: "Import lớp học từ file Excel" })
    async importExcel(@UploadedFile() file: Express.Multer.File, @Request() req) {
        if (!file) throw new BadRequestException("Vui lòng chọn file Excel");

        const ExcelJS = await import("exceljs");
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(file.buffer as any);

        const sheet = workbook.worksheets[0];
        if (!sheet) throw new BadRequestException("File Excel không có sheet nào");

        // Phase 1: Parse all rows
        const rows: { name: string; grade?: string; description?: string; rowIdx: number }[] = [];
        for (let rowIdx = 3; rowIdx <= sheet.rowCount; rowIdx++) {
            const row = sheet.getRow(rowIdx);
            const name = row.getCell(1).value?.toString().trim();
            if (!name) continue;
            const grade = row.getCell(2).value?.toString().trim() || undefined;
            const description = row.getCell(3).value?.toString().trim() || undefined;
            rows.push({ name, grade, description, rowIdx });
        }

        if (rows.length === 0) throw new BadRequestException("Không tìm thấy dữ liệu hợp lệ trong file");

        // Phase 2: Pre-validate
        const errors: string[] = [];
        const nameSet = new Set<string>();
        const classRepo = this.dataSource.getRepository(Class);
        const createdById = req.user.userId;

        for (const r of rows) {
            if (nameSet.has(r.name)) {
                errors.push(`Dòng ${r.rowIdx}: Tên lớp "${r.name}" trùng trong file`);
                continue;
            }
            nameSet.add(r.name);

            const existing = await classRepo.findOne({ where: { name: r.name, createdById } });
            if (existing) {
                errors.push(`Dòng ${r.rowIdx}: Lớp "${r.name}" đã tồn tại`);
                continue;
            }
        }

        if (errors.length > 0) {
            throw new BadRequestException({
                message: `Import thất bại: ${errors.length}/${rows.length} dòng lỗi`,
                errors,
            });
        }

        // Phase 3: Insert all in transaction
        await this.dataSource.transaction(async (manager) => {
            const txClassRepo = manager.getRepository(Class);
            for (const r of rows) {
                const newClass = txClassRepo.create({
                    name: r.name,
                    grade: r.grade,
                    description: r.description,
                    createdById,
                });
                await txClassRepo.save(newClass);
            }
        });

        return {
            message: `Import hoàn tất: ${rows.length}/${rows.length} lớp thành công`,
            total: rows.length,
            success: rows.length,
            failed: 0,
            errors: [],
        };
    }

    /** Lấy danh sách tất cả lớp học (HOD chỉ thấy lớp mình tạo) */
    @Get()
    @Roles(ROLE.HEAD_OF_DEPARTMENT, ROLE.ADMIN)
    @ApiOperation({ summary: "Lấy danh sách lớp học" })
    @ApiResponse({ status: 200, description: "Danh sách lớp học" })
    async findAll(@Request() req) {
        if (req.user.role === ROLE.ADMIN) {
            return this.classService.findAll();
        }
        return this.classService.findAllByHod(req.user.userId);
    }

    /** Lấy chi tiết lớp học */
    @Get(":id")
    @Roles(ROLE.HEAD_OF_DEPARTMENT, ROLE.ADMIN)
    @ApiOperation({ summary: "Lấy chi tiết lớp học" })
    @ApiResponse({ status: 200, description: "Chi tiết lớp học" })
    async findOne(@Param("id") id: string) {
        return this.classService.findOne(id);
    }

    /** Cập nhật thông tin lớp học (HOD) */
    @Patch(":id")
    @Roles(ROLE.HEAD_OF_DEPARTMENT)
    @ApiOperation({ summary: "Cập nhật lớp học (HOD)" })
    @ApiResponse({ status: 200, description: "Cập nhật thành công" })
    async update(@Param("id") id: string, @Body() updateClassDto: UpdateClassDto, @Request() req) {
        const classEntity = await this.classService.update(id, updateClassDto, req.user.userId);
        return {
            message: "Cập nhật lớp học thành công",
            class: classEntity,
        };
    }

    /** Xóa lớp học (HOD) */
    @Delete(":id")
    @Roles(ROLE.HEAD_OF_DEPARTMENT)
    @ApiOperation({ summary: "Xóa lớp học (HOD)" })
    @ApiResponse({ status: 200, description: "Xóa thành công" })
    async remove(@Param("id") id: string, @Request() req) {
        await this.classService.remove(id, req.user.userId);
        return { message: "Xóa lớp học thành công" };
    }

    /** Gán giáo viên vào lớp học (HOD) */
    @Post(":id/assign-lecturers")
    @Roles(ROLE.HEAD_OF_DEPARTMENT)
    @ApiOperation({ summary: "Gán giáo viên vào lớp học (HOD)" })
    @ApiResponse({ status: 200, description: "Gán giáo viên thành công" })
    async assignLecturers(@Param("id") id: string, @Body() assignLecturersDto: AssignLecturersDto, @Request() req) {
        const classEntity = await this.classService.assignLecturers(id, assignLecturersDto.lecturerIds, req.user.userId);
        return {
            message: "Gán giáo viên thành công",
            class: classEntity,
        };
    }

    /** Gỡ giáo viên khỏi lớp học (HOD) */
    @Delete(":id/lecturers/:lecturerId")
    @Roles(ROLE.HEAD_OF_DEPARTMENT)
    @ApiOperation({ summary: "Gỡ giáo viên khỏi lớp học (HOD)" })
    @ApiResponse({ status: 200, description: "Gỡ giáo viên thành công" })
    async removeLecturer(@Param("id") id: string, @Param("lecturerId") lecturerId: string, @Request() req) {
        const classEntity = await this.classService.removeLecturer(id, lecturerId, req.user.userId);
        return {
            message: "Gỡ giáo viên khỏi lớp thành công",
            class: classEntity,
        };
    }
}
