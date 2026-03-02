import { IsString, IsEnum, IsUUID, IsObject, IsInt, Min, Max, ValidateNested, IsArray, ArrayMinSize, ArrayMaxSize, IsBoolean, IsOptional, IsUrl } from "class-validator";
import { Type } from "class-transformer";
import { QuestionType, CognitiveLevel } from "../interfaces/question-data.interface";

// MCQ DTOs
export class MCQOptionDto {
    @IsString()
    text: string;

    @IsString()
    label: string; // A, B, C, D
}

export class MCQDataDto {
    @IsArray()
    @ArrayMinSize(4)
    @ArrayMaxSize(4)
    @ValidateNested({ each: true })
    @Type(() => MCQOptionDto)
    options: MCQOptionDto[];

    @IsString()
    correctLabel: string; // Will be converted to correct_option_id
}

// Group DTOs
export class SubQuestionDto {
    @IsString()
    text: string;

    @IsString()
    label: string; // a, b, c, d

    @IsBoolean()
    is_correct: boolean;
}

export class GroupDataDto {
    @IsArray()
    @ArrayMinSize(4)
    @ArrayMaxSize(4)
    @ValidateNested({ each: true })
    @Type(() => SubQuestionDto)
    sub_questions: SubQuestionDto[];
}

// Short Answer DTOs
export class ShortAnswerDataDto {
    @IsString()
    @IsOptional()
    sample_answer?: string;
}

// Main DTO
export class CreateQuestionDto {
    @IsUUID()
    poolId: string;

    @IsEnum(QuestionType)
    questionType: QuestionType;

    @IsString()
    content: string;

    @IsInt()
    @Min(1)
    @Max(3)
    cognitiveLevel: CognitiveLevel;

    @IsObject()
    data: MCQDataDto | GroupDataDto | ShortAnswerDataDto;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    images?: string[];
}
