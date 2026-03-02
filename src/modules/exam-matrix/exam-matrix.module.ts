import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ExamMatrixService } from "./exam-matrix.service";
import { ExamMatrixController } from "./exam-matrix.controller";
import { ExamMatrix } from "./entities/exam-matrix.entity";
import { ExamSession } from "../exam-session/entities/exam-session.entity";
import { Question } from "../question/entities/question.entity";
import { QuestionPoolModule } from "../question-pool/question-pool.module";

@Module({
    imports: [TypeOrmModule.forFeature([ExamMatrix, ExamSession, Question]), QuestionPoolModule],
    controllers: [ExamMatrixController],
    providers: [ExamMatrixService],
    exports: [ExamMatrixService],
})
export class ExamMatrixModule {}
