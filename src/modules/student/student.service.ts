/**
 * Service quản lý học sinh
 * Bao gồm: CRUD tài khoản, đăng nhập, đổi mật khẩu, reset mật khẩu
 */
import { Injectable, NotFoundException, BadRequestException, UnauthorizedException, ConflictException, ForbiddenException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { Student } from "./entities/student.entity";
import { StudentExam } from "../student-exam/entities/student-exam.entity";
import { Class } from "../class/entities/class.entity";
import { CreateStudentDto } from "./dto/create-student.dto";
import { UpdateStudentDto } from "./dto/update-student.dto";

const DEFAULT_PASSWORD = "123456789";
const SALT_ROUNDS = 10;

@Injectable()
export class StudentService {
    constructor(
        @InjectRepository(Student)
        private studentRepository: Repository<Student>,
        @InjectRepository(StudentExam)
        private studentExamRepository: Repository<StudentExam>,
        @InjectRepository(Class)
        private classRepository: Repository<Class>,
        private jwtService: JwtService,
    ) {}

    /* ============================
     * Auth: Đăng nhập & đổi mật khẩu
     * ============================ */

    /** Đăng nhập học sinh bằng username + password */
    async login(username: string, password: string) {
        // Tìm theo username hoặc studentCode
        const student = await this.studentRepository.findOne({
            where: [{ username }, { studentCode: username }],
        });

        if (!student || !student.password) {
            throw new UnauthorizedException("Tên đăng nhập hoặc mật khẩu không đúng");
        }

        const isPasswordValid = await bcrypt.compare(password, student.password);
        if (!isPasswordValid) {
            throw new UnauthorizedException("Tên đăng nhập hoặc mật khẩu không đúng");
        }

        // Tạo JWT token cho học sinh
        const payload = {
            sub: student.id,
            username: student.username,
            role: "STUDENT",
            type: "student", // Phân biệt với token admin/lecturer
        };

        return {
            access_token: this.jwtService.sign(payload),
            student: {
                id: student.id,
                studentCode: student.studentCode,
                fullName: student.fullName,
                className: student.className,
                mustChangePassword: student.mustChangePassword,
            },
        };
    }

    /** Đổi mật khẩu lần đầu (bắt buộc sau lần đăng nhập đầu tiên) */
    async forceChangePassword(studentId: string, newPassword: string) {
        const student = await this.studentRepository.findOne({ where: { id: studentId } });
        if (!student) {
            throw new NotFoundException("Không tìm thấy học sinh");
        }

        if (!student.mustChangePassword) {
            throw new BadRequestException("Tài khoản không yêu cầu đổi mật khẩu");
        }

        student.password = await bcrypt.hash(newPassword, SALT_ROUNDS);
        student.mustChangePassword = false;
        await this.studentRepository.save(student);

        return { message: "Đổi mật khẩu thành công" };
    }

    /** Đổi mật khẩu (cần mật khẩu cũ) */
    async changePassword(studentId: string, oldPassword: string, newPassword: string) {
        const student = await this.studentRepository.findOne({ where: { id: studentId } });
        if (!student) {
            throw new NotFoundException("Không tìm thấy học sinh");
        }

        const isOldValid = await bcrypt.compare(oldPassword, student.password);
        if (!isOldValid) {
            throw new UnauthorizedException("Mật khẩu cũ không chính xác");
        }

        student.password = await bcrypt.hash(newPassword, SALT_ROUNDS);
        await this.studentRepository.save(student);

        return { message: "Đổi mật khẩu thành công" };
    }

    /* ============================
     * CRUD: Quản lý bởi Giáo viên
     * ============================ */

    /** Tạo tài khoản học sinh (GV tạo) */
    async create(dto: CreateStudentDto): Promise<Student> {
        // Kiểm tra lớp học có tồn tại
        if (dto.className) {
            const classExists = await this.classRepository.findOne({ where: { name: dto.className } });
            if (!classExists) {
                throw new BadRequestException(`Lớp "${dto.className}" không tồn tại trong hệ thống. Vui lòng tạo lớp trước khi thêm học sinh.`);
            }
        }

        // Kiểm tra mã HS trùng
        const existingCode = await this.studentRepository.findOne({
            where: { studentCode: dto.studentCode },
        });
        if (existingCode) {
            throw new ConflictException(`Mã học sinh "${dto.studentCode}" đã tồn tại`);
        }

        // Username mặc định = studentCode nếu không cung cấp
        const username = dto.username || dto.studentCode;

        // Kiểm tra username trùng
        const existingUsername = await this.studentRepository.findOne({
            where: { username },
        });
        if (existingUsername) {
            throw new ConflictException(`Tên đăng nhập "${username}" đã tồn tại`);
        }

        const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);

        const student = this.studentRepository.create({
            studentCode: dto.studentCode,
            fullName: dto.fullName,
            className: dto.className,
            dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
            username,
            password: hashedPassword,
            mustChangePassword: true,
        });

        return this.studentRepository.save(student);
    }

    /** Tạo nhiều học sinh cùng lúc (import) */
    async createMany(dtos: CreateStudentDto[]): Promise<{ success: Student[]; errors: any[] }> {
        const success: Student[] = [];
        const errors: any[] = [];

        for (const dto of dtos) {
            try {
                const student = await this.create(dto);
                success.push(student);
            } catch (error) {
                errors.push({
                    studentCode: dto.studentCode,
                    fullName: dto.fullName,
                    error: error.message,
                });
            }
        }

        return { success, errors };
    }

    /** Lấy danh sách tất cả học sinh */
    async findAll(): Promise<Student[]> {
        return this.studentRepository.find({
            select: ["id", "studentCode", "fullName", "className", "dateOfBirth", "username", "mustChangePassword", "createdAt"],
            order: { className: "ASC", fullName: "ASC" },
        });
    }

    /** Lấy danh sách học sinh theo lớp */
    async findByClass(className: string): Promise<Student[]> {
        return this.studentRepository.find({
            where: { className },
            select: ["id", "studentCode", "fullName", "className", "dateOfBirth", "username", "mustChangePassword", "createdAt"],
            order: { fullName: "ASC" },
        });
    }

    /** Lấy danh sách học sinh theo nhiều lớp (cho Lecturer) */
    async findByClassNames(classNames: string[]): Promise<Student[]> {
        return this.studentRepository.find({
            where: { className: In(classNames) },
            select: ["id", "studentCode", "fullName", "className", "dateOfBirth", "username", "mustChangePassword", "createdAt"],
            order: { className: "ASC", fullName: "ASC" },
        });
    }

    /** Lấy thông tin 1 học sinh */
    async findOne(id: string): Promise<Student> {
        const student = await this.studentRepository.findOne({
            where: { id },
            select: ["id", "studentCode", "fullName", "className", "dateOfBirth", "username", "mustChangePassword", "createdAt", "updatedAt"],
        });
        if (!student) {
            throw new NotFoundException("Không tìm thấy học sinh");
        }
        return student;
    }

    /** Cập nhật thông tin học sinh */
    async update(id: string, dto: UpdateStudentDto): Promise<Student> {
        const student = await this.studentRepository.findOne({ where: { id } });
        if (!student) {
            throw new NotFoundException("Không tìm thấy học sinh");
        }

        if (dto.fullName) student.fullName = dto.fullName;
        if (dto.className !== undefined) student.className = dto.className;
        if (dto.dateOfBirth) student.dateOfBirth = new Date(dto.dateOfBirth);

        return this.studentRepository.save(student);
    }

    /** Xóa học sinh */
    async remove(id: string): Promise<void> {
        const student = await this.studentRepository.findOne({ where: { id } });
        if (!student) {
            throw new NotFoundException("Không tìm thấy học sinh");
        }

        // Kiểm tra có bài thi không
        const examCount = await this.studentExamRepository.count({ where: { studentId: id } });
        if (examCount > 0) {
            throw new BadRequestException(`Không thể xóa học sinh "${student.fullName}" vì đã có ${examCount} bài thi. Hãy xóa bài thi trước.`);
        }

        await this.studentRepository.remove(student);
    }

    /** Reset mật khẩu về mặc định */
    async resetPassword(id: string) {
        const student = await this.studentRepository.findOne({ where: { id } });
        if (!student) {
            throw new NotFoundException("Không tìm thấy học sinh");
        }

        student.password = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);
        student.mustChangePassword = true;
        await this.studentRepository.save(student);

        return {
            message: "Reset mật khẩu thành công",
            defaultPassword: DEFAULT_PASSWORD,
        };
    }

    /** Validate student bằng ID (dùng cho JWT strategy) */
    async validateStudent(studentId: string): Promise<Student> {
        return this.studentRepository.findOne({ where: { id: studentId } });
    }

    /* ============================
     * Exam Sessions: Xem và bắt đầu thi
     * ============================ */

    /** Lấy danh sách ca thi (student_exams) của học sinh, kèm thông tin session */
    async getMyExamSessions(studentId: string) {
        const studentExams = await this.studentExamRepository.find({
            where: { studentId },
            relations: ["session", "session.matrix", "session.matrix.subject"],
            order: { session: { startTime: "DESC" } },
        });

        return studentExams.map((se) => ({
            id: se.id,
            sessionId: se.sessionId,
            sessionName: se.session?.name,
            subjectName: se.session?.matrix?.subject?.name,
            startTime: se.session?.startTime,
            endTime: se.session?.endTime,
            durationMinutes: se.session?.durationMinutes,
            sessionStatus: se.session?.status,
            showScore: (se.session as any)?.showScore ?? false, // Cho phép FE biết có được xem điểm không
            status: se.status,
            score: se.score,
            startedAt: se.startedAt,
            submittedAt: se.submittedAt,
        }));
    }

    /** Bắt đầu thi bằng JWT (kiểm tra quyền sở hữu student_exam) */
    async startExamByJwt(studentId: string, studentExamId: string) {
        const studentExam = await this.studentExamRepository.findOne({
            where: { id: studentExamId },
            relations: ["session"],
        });

        if (!studentExam) {
            throw new NotFoundException("Không tìm thấy bài thi");
        }

        if (studentExam.studentId !== studentId) {
            throw new ForbiddenException("Bạn không có quyền truy cập bài thi này");
        }

        // Trả về thông tin cần thiết để frontend sử dụng luồng thi
        return {
            studentExamId: studentExam.id,
            sessionId: studentExam.sessionId,
            // [CƠ CHẾ CŨ] accessCode: studentExam.accessCode,
            session: studentExam.session,
            status: studentExam.status,
            showScore: (studentExam.session as any)?.showScore ?? false,
        };
    }
}
