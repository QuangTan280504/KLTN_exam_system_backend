/**
 * Module quản lý lớp học
 * Bao gồm entity Class, service và controller
 * Import User entity để xử lý quan hệ nhiều-nhiều với giáo viên
 * Bao gồm cả thống kê cho HOD
 */
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ClassService } from "./class.service";
import { ClassController } from "./class.controller";
import { HodStatisticsService } from "./hod-statistics.service";
import { HodStatisticsController } from "./hod-statistics.controller";
import { Class } from "./entities/class.entity";
import { User } from "../auth/entities/user.entity";
import { Student } from "../student/entities/student.entity";
import { ExamSession } from "../exam-session/entities/exam-session.entity";
import { StudentExam } from "../student-exam/entities/student-exam.entity";

@Module({
    imports: [TypeOrmModule.forFeature([Class, User, Student, ExamSession, StudentExam])],
    controllers: [ClassController, HodStatisticsController],
    providers: [ClassService, HodStatisticsService],
    exports: [ClassService],
})
export class ClassModule {}
