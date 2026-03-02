/**
 * Controller quản lý tài khoản Học sinh bởi Giáo viên/Admin
 * Prefix: /students
 */
import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Request, UseGuards, UseInterceptors, UploadedFile, Res, BadRequestException } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { Response } from "express";
import { DataSource } from "typeorm";
import * as bcrypt from "bcrypt";
import { StudentService } from "./student.service";
import { CreateStudentDto } from "./dto/create-student.dto";
import { UpdateStudentDto } from "./dto/update-student.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { ROLE } from "src/constants";
import { TemplateGeneratorService } from "../../shared/services/template-generator.service";
import { Student } from "./entities/student.entity";
import { Class } from "../class/entities/class.entity";

@ApiTags("students")
@Controller("students")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("access-token")
export class StudentController {
    constructor(
        private readonly studentService: StudentService,
        private readonly templateService: TemplateGeneratorService,
        private readonly dataSource: DataSource,
    ) {}

    /** Tạo tài khoản học sinh */
    @Post()
    @Roles(ROLE.LECTURER, ROLE.HEAD_OF_DEPARTMENT, ROLE.ADMIN)
    @ApiOperation({ summary: "Tạo tài khoản học sinh" })
    @ApiResponse({ status: 201, description: "Tạo thành công" })
    async create(@Body() dto: CreateStudentDto) {
        const student = await this.studentService.create(dto);
        return {
            message: "Tạo tài khoản học sinh thành công",
            defaultPassword: "123456789",
            student: {
                id: student.id,
                studentCode: student.studentCode,
                fullName: student.fullName,
                className: student.className,
                username: student.username,
            },
        };
    }

    /** Tạo nhiều học sinh cùng lúc (import) */
    @Post("bulk")
    @Roles(ROLE.LECTURER, ROLE.HEAD_OF_DEPARTMENT, ROLE.ADMIN)
    @ApiOperation({ summary: "Tạo nhiều tài khoản học sinh (import)" })
    @ApiResponse({ status: 201, description: "Import thành công" })
    async createMany(@Body() dtos: CreateStudentDto[]) {
        const result = await this.studentService.createMany(dtos);
        return {
            message: `Import thành công ${result.success.length} học sinh, lỗi ${result.errors.length}`,
            defaultPassword: "123456789",
            success: result.success.map((s) => ({
                id: s.id,
                studentCode: s.studentCode,
                fullName: s.fullName,
                username: s.username,
            })),
            errors: result.errors,
        };
    }

    /** Danh sách tất cả học sinh */
    @Get()
    @Roles(ROLE.LECTURER, ROLE.HEAD_OF_DEPARTMENT, ROLE.ADMIN)
    @ApiOperation({ summary: "Danh sách học sinh" })
    @ApiQuery({ name: "className", required: false, description: "Lọc theo lớp" })
    async findAll(@Query("className") className?: string, @Request() req?: any) {
        // LECTURER: chỉ xem học sinh thuộc lớp mình phụ trách
        if (req?.user?.role === ROLE.LECTURER) {
            const classRepo = this.dataSource.getRepository(Class);
            const myClasses = await classRepo.createQueryBuilder("class").innerJoin("class.lecturers", "lecturer", "lecturer.id = :lecturerId", { lecturerId: req.user.userId }).getMany();
            const myClassNames = myClasses.map((c) => c.name);
            if (myClassNames.length === 0) return [];
            if (className) {
                // Chỉ cho phép lọc nếu lớp nằm trong danh sách lớp được phân công
                if (!myClassNames.includes(className)) return [];
                return this.studentService.findByClass(className);
            }
            return this.studentService.findByClassNames(myClassNames);
        }
        if (className) {
            return this.studentService.findByClass(className);
        }
        return this.studentService.findAll();
    }

    /** Tải mẫu Excel import học sinh */
    @Get("import-template")
    @Roles(ROLE.LECTURER, ROLE.HEAD_OF_DEPARTMENT, ROLE.ADMIN)
    @ApiOperation({ summary: "Tải mẫu Excel import học sinh" })
    async downloadTemplate(@Res() res: Response) {
        const buffer = await this.templateService.generate([
            {
                name: "Danh sách học sinh",
                columns: [
                    { header: "Mã học sinh", key: "studentCode", width: 18, required: true, note: "Mã duy nhất, VD: HS001" },
                    { header: "Họ và tên", key: "fullName", width: 28, required: true },
                    { header: "Ngày sinh", key: "dateOfBirth", width: 16, note: "DD/MM/YYYY" },
                    { header: "Lớp", key: "className", width: 14, note: "VD: 10A1" },
                ],
                sampleRows: [
                    { studentCode: "HS001", fullName: "Nguyễn Văn A", dateOfBirth: "15/03/2008", className: "10A1" },
                    { studentCode: "HS002", fullName: "Trần Thị B", dateOfBirth: "22/07/2008", className: "10A1" },
                    { studentCode: "HS003", fullName: "Lê Văn C", dateOfBirth: "01/12/2008", className: "10A2" },
                ],
            },
        ]);

        res.set({
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": 'attachment; filename="mau_import_hoc_sinh.xlsx"',
        });
        res.send(buffer);
    }

    /** Import học sinh từ file Excel */
    @Post("import-excel")
    @Roles(ROLE.LECTURER, ROLE.HEAD_OF_DEPARTMENT, ROLE.ADMIN)
    @UseInterceptors(FileInterceptor("file"))
    @ApiOperation({ summary: "Import học sinh từ file Excel" })
    async importFromExcel(@UploadedFile() file: Express.Multer.File) {
        if (!file) {
            throw new BadRequestException("Chưa chọn file");
        }

        const ExcelJS = await import("exceljs");
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(file.buffer as any);

        const sheet = workbook.worksheets[0];
        if (!sheet) {
            throw new BadRequestException("File Excel không có sheet nào");
        }

        // Phase 1: Parse all rows
        const rows: { studentCode: string; fullName: string; dateOfBirth?: string; className?: string; rowIdx: number }[] = [];
        sheet.eachRow((row, rowNumber) => {
            if (rowNumber <= 2) return;

            const getCell = (idx: number) => {
                const cell = row.getCell(idx);
                return cell.value ? cell.value.toString().trim() : "";
            };

            const studentCode = getCell(1);
            const fullName = getCell(2);
            const dobRaw = getCell(3);
            const className = getCell(4);

            if (!studentCode || !fullName) return;

            let dateOfBirth: string | undefined;
            if (dobRaw) {
                const match = dobRaw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
                if (match) {
                    dateOfBirth = `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
                } else if (row.getCell(3).value instanceof Date) {
                    const d = row.getCell(3).value as Date;
                    dateOfBirth = d.toISOString().split("T")[0];
                }
            }

            rows.push({ studentCode, fullName, className: className || undefined, dateOfBirth, rowIdx: rowNumber });
        });

        if (rows.length === 0) {
            throw new BadRequestException("Không tìm thấy dữ liệu hợp lệ trong file");
        }

        // Phase 2: Pre-validate
        const errors: string[] = [];
        const codeSet = new Set<string>();
        const studentRepo = this.dataSource.getRepository(Student);
        const classRepo = this.dataSource.getRepository(Class);

        // Lấy danh sách tất cả lớp học để validate
        const allClasses = await classRepo.find({ select: ["name"] });
        const validClassNames = new Set(allClasses.map((c) => c.name));

        for (const r of rows) {
            if (codeSet.has(r.studentCode)) {
                errors.push(`Dòng ${r.rowIdx}: Mã HS "${r.studentCode}" trùng trong file`);
                continue;
            }
            codeSet.add(r.studentCode);

            const existing = await studentRepo.findOne({ where: { studentCode: r.studentCode } });
            if (existing) {
                errors.push(`Dòng ${r.rowIdx}: Mã HS "${r.studentCode}" đã tồn tại trong hệ thống`);
                continue;
            }

            // Kiểm tra lớp học có tồn tại không
            if (r.className && !validClassNames.has(r.className)) {
                errors.push(`Dòng ${r.rowIdx}: Lớp "${r.className}" không tồn tại trong hệ thống`);
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
            const txStudentRepo = manager.getRepository(Student);
            for (const r of rows) {
                const hashedPassword = await bcrypt.hash("123456789", 10);
                const student = txStudentRepo.create({
                    studentCode: r.studentCode,
                    fullName: r.fullName,
                    className: r.className,
                    dateOfBirth: r.dateOfBirth ? new Date(r.dateOfBirth) : null,
                    username: r.studentCode,
                    password: hashedPassword,
                    mustChangePassword: true,
                });
                await txStudentRepo.save(student);
            }
        });

        return {
            message: `Import hoàn tất: ${rows.length}/${rows.length} học sinh thành công`,
            defaultPassword: "123456789",
            total: rows.length,
            success: rows.length,
            failed: 0,
            errors: [],
        };
    }

    /** Chi tiết 1 học sinh */
    @Get(":id")
    @Roles(ROLE.LECTURER, ROLE.HEAD_OF_DEPARTMENT, ROLE.ADMIN)
    @ApiOperation({ summary: "Chi tiết học sinh" })
    async findOne(@Param("id") id: string) {
        return this.studentService.findOne(id);
    }

    /** Cập nhật thông tin học sinh */
    @Patch(":id")
    @Roles(ROLE.LECTURER, ROLE.HEAD_OF_DEPARTMENT, ROLE.ADMIN)
    @ApiOperation({ summary: "Cập nhật thông tin học sinh" })
    async update(@Param("id") id: string, @Body() dto: UpdateStudentDto) {
        const student = await this.studentService.update(id, dto);
        return {
            message: "Cập nhật thành công",
            student: {
                id: student.id,
                studentCode: student.studentCode,
                fullName: student.fullName,
                className: student.className,
            },
        };
    }

    /** Xóa học sinh */
    @Delete(":id")
    @Roles(ROLE.LECTURER, ROLE.HEAD_OF_DEPARTMENT, ROLE.ADMIN)
    @ApiOperation({ summary: "Xóa tài khoản học sinh" })
    async remove(@Param("id") id: string) {
        await this.studentService.remove(id);
        return { message: "Xóa học sinh thành công" };
    }

    /** Reset mật khẩu học sinh về mặc định */
    @Post(":id/reset-password")
    @Roles(ROLE.LECTURER, ROLE.HEAD_OF_DEPARTMENT, ROLE.ADMIN)
    @ApiOperation({ summary: "Reset mật khẩu học sinh" })
    async resetPassword(@Param("id") id: string) {
        return this.studentService.resetPassword(id);
    }
}
