import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportService } from './report.service';
import { ReportController } from './report.controller';
import { StudentExam } from '../student-exam/entities/student-exam.entity';
import { Question } from '../question/entities/question.entity';

import { Subject } from '../subject/entities/subject.entity';
import { ExamSession } from '../exam-session/entities/exam-session.entity';

import { Student } from '../student/entities/student.entity';

@Module({
    imports: [TypeOrmModule.forFeature([StudentExam, Question, Subject, ExamSession, Student])],
    controllers: [ReportController],
    providers: [ReportService],
    exports: [ReportService],
})
export class ReportModule { }
