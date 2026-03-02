import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ExamSessionService } from "./exam-session.service";
import { ExamSessionController } from "./exam-session.controller";
import { ExamSession } from "./entities/exam-session.entity";
import { Student } from "../student/entities/student.entity";
import { StudentExam } from "../student-exam/entities/student-exam.entity";

// [CƠ CHẾ CŨ] import { StudentImportService } from './services/student-import.service';

import { ExamSessionScheduler } from "./exam-session.scheduler";

@Module({
    imports: [TypeOrmModule.forFeature([ExamSession, Student, StudentExam])],
    controllers: [ExamSessionController],
    providers: [ExamSessionService, /* StudentImportService, */ ExamSessionScheduler],
    exports: [ExamSessionService],
})
export class ExamSessionModule {}
