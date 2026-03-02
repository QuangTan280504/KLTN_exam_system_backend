import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuestionService } from './question.service';
import { QuestionController } from './question.controller';
import { Question } from './entities/question.entity';
import { ExcelImportService } from './services/excel-import.service';

@Module({
    imports: [TypeOrmModule.forFeature([Question])],
    controllers: [QuestionController],
    providers: [QuestionService, ExcelImportService],
    exports: [QuestionService],
})
export class QuestionModule { }
