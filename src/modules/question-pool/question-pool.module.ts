import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuestionPoolService } from './question-pool.service';
import { QuestionImportService } from './services/question-import.service';
import { QuestionPoolController } from './question-pool.controller';
import { QuestionPool } from './entities/question-pool.entity';
import { Question } from '../question/entities/question.entity';
import { ExamMatrix } from '../exam-matrix/entities/exam-matrix.entity';

@Module({
    imports: [TypeOrmModule.forFeature([QuestionPool, Question, ExamMatrix])],
    controllers: [QuestionPoolController],
    providers: [QuestionPoolService, QuestionImportService],
    exports: [QuestionPoolService],
})
export class QuestionPoolModule { }
