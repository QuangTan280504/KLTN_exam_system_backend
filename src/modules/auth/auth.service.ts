import { Injectable, UnauthorizedException, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { User } from "./entities/user.entity";
import { Class } from "../class/entities/class.entity";
import { LoginDto } from "./dto/login.dto";
import { ROLE, REGEX, CONSTANTS } from "src/constants";

@Injectable()
export class AuthService {
    constructor(
        @InjectRepository(User)
        private userRepository: Repository<User>,
        @InjectRepository(Class)
        private classRepository: Repository<Class>,
        private jwtService: JwtService,
    ) {}

    async login(loginDto: LoginDto) {
        const { identifier, password } = loginDto;

        // Determine the type of identifier and find user
        let user: User | null = null;

        // Check if it's an email
        if (identifier.includes("@")) {
            user = await this.userRepository.findOne({ where: { email: identifier } });
        }
        // Check if it's a phone number (starts with 0 and contains only digits)
        else if (/^0\d{9,10}$/.test(identifier)) {
            user = await this.userRepository.findOne({ where: { phone: identifier } });
        }
        // Otherwise, treat it as username
        else {
            user = await this.userRepository.findOne({ where: { username: identifier } });
        }

        if (!user) {
            throw new UnauthorizedException("Invalid credentials");
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            throw new UnauthorizedException("Invalid credentials");
        }

        // Generate JWT
        const payload = {
            sub: user.id,
            username: user.username,
            role: user.role,
        };

        return {
            access_token: this.jwtService.sign(payload),
            user: {
                id: user.id,
                username: user.username,
                fullName: user.fullName,
                email: user.email,
                phone: user.phone,
                role: user.role,
                isFirstLogin: user.isFirstLogin,
            },
        };
    }

    async validateUser(userId: string): Promise<User> {
        return this.userRepository.findOne({ where: { id: userId } });
    }

    async createUser(username: string, password: string, fullName: string, role = "ADMIN"): Promise<User> {
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = this.userRepository.create({
            username,
            password: hashedPassword,
            fullName,
            role,
        });
        return this.userRepository.save(user);
    }

    async changePassword(userId: string, oldPassword: string, newPassword: string) {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) {
            throw new UnauthorizedException("User not found");
        }

        const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);
        if (!isOldPasswordValid) {
            throw new UnauthorizedException("Mật khẩu cũ không chính xác");
        }

        user.password = await bcrypt.hash(newPassword, 10);
        await this.userRepository.save(user);
        return { message: "Đổi mật khẩu thành công" };
    }

    async forceChangePassword(userId: string, newPassword: string) {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) {
            throw new UnauthorizedException("User not found");
        }

        // Only allow force change password if it's first login
        if (!user.isFirstLogin) {
            throw new UnauthorizedException("Chỉ có thể đổi mật khẩu lần đầu khi đăng nhập lần đầu tiên");
        }

        user.password = await bcrypt.hash(newPassword, 10);
        user.isFirstLogin = false;
        await this.userRepository.save(user);
        return { message: "Đổi mật khẩu thành công" };
    }

    async createLecturer(fullName: string, email: string, phone?: string): Promise<User> {
        // Validate email format
        if (!REGEX.EMAIL.test(email)) {
            throw new BadRequestException("Email không hợp lệ");
        }
        // Validate phone format
        if (phone && !REGEX.PHONE.test(phone)) {
            throw new BadRequestException("Số điện thoại không hợp lệ");
        }

        // Check if email already exists
        const existingEmail = await this.userRepository.findOne({ where: { email } });
        if (existingEmail) {
            throw new UnauthorizedException("Email đã tồn tại trong hệ thống");
        }

        // Check if phone already exists (if provided)
        if (phone) {
            const existingPhone = await this.userRepository.findOne({ where: { phone } });
            if (existingPhone) {
                throw new UnauthorizedException("Số điện thoại đã tồn tại trong hệ thống");
            }
        }

        const hashedPassword = await bcrypt.hash(CONSTANTS.DEFAULT_PASSWORD, 10);
        const lecturer = this.userRepository.create({
            username: email, // Use email as username for lecturers
            email,
            phone,
            password: hashedPassword,
            fullName,
            role: "LECTURER",
            isFirstLogin: true,
        });

        return this.userRepository.save(lecturer);
    }

    async getAllLecturers() {
        const lecturers = await this.userRepository.createQueryBuilder("user").leftJoinAndSelect("user.classes", "class").where("user.role = :role", { role: "LECTURER" }).orderBy("user.createdAt", "DESC").getMany();
        return lecturers.map((l) => ({
            id: l.id,
            fullName: l.fullName,
            email: l.email,
            phone: l.phone,
            createdAt: l.createdAt,
            updatedAt: l.updatedAt,
            classes: l.classes?.map((c) => ({ id: c.id, name: c.name })) || [],
        }));
    }

    async getLecturerById(id: string): Promise<User> {
        const lecturer = await this.userRepository.findOne({
            where: { id, role: "LECTURER" },
        });

        if (!lecturer) {
            throw new UnauthorizedException("Giảng viên không tồn tại");
        }

        return lecturer;
    }

    async updateLecturer(id: string, fullName?: string, email?: string, phone?: string): Promise<User> {
        const lecturer = await this.getLecturerById(id);

        // Validate email format if provided
        if (email && !REGEX.EMAIL.test(email)) {
            throw new BadRequestException("Email không hợp lệ");
        }

        // Validate phone format if provided
        if (phone && !REGEX.PHONE.test(phone)) {
            throw new BadRequestException("Số điện thoại không hợp lệ");
        }
        // Check email uniqueness if changing
        if (email && email !== lecturer.email) {
            const existingEmail = await this.userRepository.findOne({ where: { email } });
            if (existingEmail) {
                throw new UnauthorizedException("Email đã tồn tại trong hệ thống");
            }
            lecturer.email = email;
            lecturer.username = email; // Update username too
        }

        // Check phone uniqueness if changing
        if (phone && phone !== lecturer.phone) {
            const existingPhone = await this.userRepository.findOne({ where: { phone } });
            if (existingPhone) {
                throw new UnauthorizedException("Số điện thoại đã tồn tại trong hệ thống");
            }
            lecturer.phone = phone;
        }

        if (fullName) {
            lecturer.fullName = fullName;
        }

        return this.userRepository.save(lecturer);
    }

    async deleteLecturer(id: string): Promise<void> {
        const lecturer = await this.getLecturerById(id);

        // Kiểm tra giáo viên có đang được gán vào lớp nào không
        const assignedClasses = await this.classRepository.createQueryBuilder("class").innerJoin("class.lecturers", "lecturer", "lecturer.id = :lecturerId", { lecturerId: id }).getMany();
        if (assignedClasses.length > 0) {
            const classNames = assignedClasses.map((c) => c.name).join(", ");
            throw new BadRequestException(`Không thể xóa giảng viên "${lecturer.fullName}" vì đang phụ trách lớp: ${classNames}. Hãy gỡ khỏi lớp trước.`);
        }

        await this.userRepository.remove(lecturer);
    }

    async resetLecturerPassword(id: string): Promise<void> {
        const lecturer = await this.getLecturerById(id);

        lecturer.password = await bcrypt.hash(CONSTANTS.DEFAULT_PASSWORD, 10);
        lecturer.isFirstLogin = true;
        await this.userRepository.save(lecturer);
    }

    /**
     * Create Head of Department
     * @param fullName is name of head of department
     * @param email is email of head of department
     * @param phone is phone of head of department
     * @returns entity head of department
     */
    async createHeadOfDepartment(fullName: string, email: string, phone?: string): Promise<User> {
        // Validate email format
        if (!REGEX.EMAIL.test(email)) {
            throw new BadRequestException("Email không hợp lệ");
        }
        // Validate phone format
        if (phone && !REGEX.PHONE.test(phone)) {
            throw new BadRequestException("Số điện thoại không hợp lệ");
        }

        // Check if email already exists
        const existingEmail = await this.userRepository.findOne({ where: { email } });
        if (existingEmail) {
            throw new UnauthorizedException("Email đã tồn tại trong hệ thống");
        }

        // Check if phone already exists (if provided)
        if (phone) {
            const existingPhone = await this.userRepository.findOne({ where: { phone } });
            if (existingPhone) {
                throw new UnauthorizedException("Số điện thoại đã tồn tại trong hệ thống");
            }
        }

        const hashedPassword = await bcrypt.hash(CONSTANTS.DEFAULT_PASSWORD, 10);
        const headOfDepartment = this.userRepository.create({
            username: email, // Use email as username for head of department
            email,
            phone,
            password: hashedPassword,
            fullName,
            role: ROLE.HEAD_OF_DEPARTMENT,
            isFirstLogin: true,
        });

        return this.userRepository.save(headOfDepartment);
    }

    /**
     * Get all head of departments
     * @returns list of head of departments
     */
    async getAllHeadOfDepartments() {
        return this.userRepository.find({
            where: { role: ROLE.HEAD_OF_DEPARTMENT },
            select: ["id", "fullName", "email", "phone", "createdAt", "updatedAt"],
            order: { createdAt: "DESC" },
        });
    }

    /**
     * Lấy thông tin HOD theo ID
     * @param id - ID của Tổ trưởng bộ môn
     */
    async getHodById(id: string): Promise<User> {
        const hod = await this.userRepository.findOne({
            where: { id, role: ROLE.HEAD_OF_DEPARTMENT },
        });
        if (!hod) {
            throw new UnauthorizedException("Tổ trưởng bộ môn không tồn tại");
        }
        return hod;
    }

    /**
     * Cập nhật thông tin Tổ trưởng bộ môn
     * @param id - ID của HOD
     * @param fullName - Họ tên mới
     * @param email - Email mới
     * @param phone - SĐT mới
     */
    async updateHod(id: string, fullName?: string, email?: string, phone?: string): Promise<User> {
        const hod = await this.getHodById(id);

        // Validate email format if provided
        if (email && !REGEX.EMAIL.test(email)) {
            throw new BadRequestException("Email không hợp lệ");
        }

        // Validate phone format if provided
        if (phone && !REGEX.PHONE.test(phone)) {
            throw new BadRequestException("Số điện thoại không hợp lệ");
        }
        // Kiểm tra trùng email nếu thay đổi
        if (email && email !== hod.email) {
            const existingEmail = await this.userRepository.findOne({ where: { email } });
            if (existingEmail) {
                throw new UnauthorizedException("Email đã tồn tại trong hệ thống");
            }
            hod.email = email;
            hod.username = email;
        }

        // Kiểm tra trùng SĐT nếu thay đổi
        if (phone && phone !== hod.phone) {
            const existingPhone = await this.userRepository.findOne({ where: { phone } });
            if (existingPhone) {
                throw new UnauthorizedException("Số điện thoại đã tồn tại trong hệ thống");
            }
            hod.phone = phone;
        }

        if (fullName) {
            hod.fullName = fullName;
        }

        return this.userRepository.save(hod);
    }

    /**
     * Xóa tài khoản Tổ trưởng bộ môn
     * @param id - ID của HOD
     */
    async deleteHod(id: string): Promise<void> {
        const hod = await this.getHodById(id);

        // Kiểm tra HOD có lớp nào không
        const createdClasses = await this.classRepository.find({ where: { createdById: id } });
        if (createdClasses.length > 0) {
            const classNames = createdClasses.map((c) => c.name).join(", ");
            throw new BadRequestException(`Không thể xóa Tổ trưởng "${hod.fullName}" vì đã tạo ${createdClasses.length} lớp học: ${classNames}. Hãy xóa lớp trước.`);
        }

        await this.userRepository.remove(hod);
    }

    /**
     * Reset mật khẩu Tổ trưởng bộ môn về mặc định
     * @param id - ID của HOD
     */
    async resetHodPassword(id: string): Promise<void> {
        const hod = await this.getHodById(id);

        hod.password = await bcrypt.hash(CONSTANTS.DEFAULT_PASSWORD, 10);
        hod.isFirstLogin = true;
        await this.userRepository.save(hod);
    }
}
