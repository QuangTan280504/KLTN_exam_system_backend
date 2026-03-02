/**
 * Service quản lý lớp học
 * Cung cấp các chức năng CRUD cho lớp học
 * Bao gồm gán/gỡ giáo viên khỏi lớp
 */
import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import { Class } from "./entities/class.entity";
import { User } from "../auth/entities/user.entity";
import { Student } from "../student/entities/student.entity";
import { CreateClassDto } from "./dto/create-class.dto";
import { UpdateClassDto } from "./dto/update-class.dto";
import { ROLE } from "src/constants";

@Injectable()
export class ClassService {
    constructor(
        @InjectRepository(Class)
        private classRepository: Repository<Class>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
        @InjectRepository(Student)
        private studentRepository: Repository<Student>,
    ) {}

    /**
     * Tạo lớp học mới
     * @param createClassDto - Thông tin lớp học
     * @param createdById - ID người tạo (HOD)
     */
    async create(createClassDto: CreateClassDto, createdById: string): Promise<Class> {
        // Kiểm tra trùng tên lớp
        const existingClass = await this.classRepository.findOne({
            where: { name: createClassDto.name, createdById },
        });
        if (existingClass) {
            throw new BadRequestException("Lớp học với tên này đã tồn tại");
        }

        const newClass = this.classRepository.create({
            ...createClassDto,
            createdById,
        });
        return this.classRepository.save(newClass);
    }

    /**
     * Lấy tất cả lớp học của một HOD
     * @param hodId - ID của Tổ trưởng bộ môn
     */
    async findAllByHod(hodId: string): Promise<Class[]> {
        return this.classRepository.find({
            where: { createdById: hodId },
            relations: ["lecturers", "createdBy"],
            order: { createdAt: "DESC" },
        });
    }

    /**
     * Lấy tất cả lớp học (cho Admin)
     */
    async findAll(): Promise<Class[]> {
        return this.classRepository.find({
            relations: ["lecturers", "createdBy"],
            order: { createdAt: "DESC" },
        });
    }

    /**
     * Lấy chi tiết một lớp học
     * @param id - ID lớp học
     */
    async findOne(id: string): Promise<Class> {
        const classEntity = await this.classRepository.findOne({
            where: { id },
            relations: ["lecturers", "createdBy"],
        });
        if (!classEntity) {
            throw new NotFoundException("Không tìm thấy lớp học");
        }
        return classEntity;
    }

    /**
     * Cập nhật thông tin lớp học
     * @param id - ID lớp học
     * @param updateClassDto - Thông tin cần cập nhật
     * @param hodId - ID của HOD (để kiểm tra quyền)
     */
    async update(id: string, updateClassDto: UpdateClassDto, hodId: string): Promise<Class> {
        const classEntity = await this.classRepository.findOne({
            where: { id, createdById: hodId },
        });
        if (!classEntity) {
            throw new NotFoundException("Không tìm thấy lớp học hoặc bạn không có quyền chỉnh sửa");
        }

        // Kiểm tra trùng tên nếu đổi tên
        if (updateClassDto.name && updateClassDto.name !== classEntity.name) {
            const existing = await this.classRepository.findOne({
                where: { name: updateClassDto.name, createdById: hodId },
            });
            if (existing) {
                throw new BadRequestException("Lớp học với tên này đã tồn tại");
            }
        }

        Object.assign(classEntity, updateClassDto);
        return this.classRepository.save(classEntity);
    }

    /**
     * Xóa lớp học
     * @param id - ID lớp học
     * @param hodId - ID của HOD (để kiểm tra quyền)
     */
    async remove(id: string, hodId: string): Promise<void> {
        const classEntity = await this.classRepository.findOne({
            where: { id, createdById: hodId },
            relations: ["lecturers"],
        });
        if (!classEntity) {
            throw new NotFoundException("Không tìm thấy lớp học hoặc bạn không có quyền xóa");
        }

        // Kiểm tra lớp còn học sinh không
        const studentCount = await this.studentRepository.count({ where: { className: classEntity.name } });
        if (studentCount > 0) {
            throw new BadRequestException(`Không thể xóa lớp "${classEntity.name}" vì còn ${studentCount} học sinh. Hãy chuyển hoặc xóa học sinh trước.`);
        }

        // Kiểm tra lớp còn giáo viên được gán không
        if (classEntity.lecturers?.length > 0) {
            throw new BadRequestException(`Không thể xóa lớp "${classEntity.name}" vì còn ${classEntity.lecturers.length} giáo viên được gán. Hãy gỡ giáo viên trước.`);
        }

        await this.classRepository.remove(classEntity);
    }

    /**
     * Gán giáo viên vào lớp học
     * @param classId - ID lớp học
     * @param lecturerIds - Danh sách ID giáo viên
     * @param hodId - ID của HOD
     */
    async assignLecturers(classId: string, lecturerIds: string[], hodId: string): Promise<Class> {
        const classEntity = await this.classRepository.findOne({
            where: { id: classId, createdById: hodId },
            relations: ["lecturers"],
        });
        if (!classEntity) {
            throw new NotFoundException("Không tìm thấy lớp học hoặc bạn không có quyền");
        }

        // Kiểm tra các giáo viên có tồn tại và có role LECTURER
        const lecturers = await this.userRepository.find({
            where: { id: In(lecturerIds), role: ROLE.LECTURER },
        });
        if (lecturers.length !== lecturerIds.length) {
            throw new BadRequestException("Một hoặc nhiều giáo viên không tồn tại trong hệ thống");
        }

        // Gán giáo viên mới (thay thế toàn bộ)
        classEntity.lecturers = lecturers;
        return this.classRepository.save(classEntity);
    }

    /**
     * Gỡ giáo viên khỏi lớp học
     * @param classId - ID lớp học
     * @param lecturerId - ID giáo viên cần gỡ
     * @param hodId - ID của HOD
     */
    async removeLecturer(classId: string, lecturerId: string, hodId: string): Promise<Class> {
        const classEntity = await this.classRepository.findOne({
            where: { id: classId, createdById: hodId },
            relations: ["lecturers"],
        });
        if (!classEntity) {
            throw new NotFoundException("Không tìm thấy lớp học hoặc bạn không có quyền");
        }

        classEntity.lecturers = classEntity.lecturers.filter((l) => l.id !== lecturerId);
        return this.classRepository.save(classEntity);
    }

    /**
     * Lấy danh sách lớp mà một giáo viên phụ trách
     * @param lecturerId - ID giáo viên
     */
    async findByLecturer(lecturerId: string): Promise<Class[]> {
        return this.classRepository.createQueryBuilder("class").innerJoin("class.lecturers", "lecturer", "lecturer.id = :lecturerId", { lecturerId }).leftJoinAndSelect("class.lecturers", "allLecturers").leftJoinAndSelect("class.createdBy", "createdBy").orderBy("class.createdAt", "DESC").getMany();
    }
}
