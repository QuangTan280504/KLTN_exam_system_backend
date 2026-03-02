import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { StudentExamService } from "./student-exam.service";
import { StudentExamController } from "./student-exam.controller";
import { StudentExam } from "./entities/student-exam.entity";
import { ExamSnapshotService } from "./services/exam-snapshot.service";
import { GradingService } from "./services/grading.service";
import { Question } from "../question/entities/question.entity";
import { ExamMatrix } from "../exam-matrix/entities/exam-matrix.entity";
import { ExamSession } from "../exam-session/entities/exam-session.entity";

@Module({
    imports: [TypeOrmModule.forFeature([StudentExam, Question, ExamMatrix, ExamSession])],
    controllers: [StudentExamController],
    providers: [StudentExamService, ExamSnapshotService, GradingService],
    exports: [StudentExamService],
})
export class StudentExamModule {}
