import { PartialType } from '@nestjs/mapped-types';
import { CreateQuestionPoolDto } from './create-question-pool.dto';
import { IsUUID, IsOptional, IsString } from 'class-validator';

export class UpdateQuestionPoolDto extends PartialType(CreateQuestionPoolDto) {
    @IsOptional()
    @IsUUID('4')
    subjectId?: string;
}
