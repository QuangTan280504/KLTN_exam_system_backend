import { IsString, IsOptional, IsUUID, IsObject, IsInt, Min, IsArray } from "class-validator";
import { CustomQuestionInput, MatrixSettings } from "../interfaces/matrix-settings.interface";

export class CreateExamMatrixDto {
    @IsString()
    name: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsUUID("4")
    @IsOptional()
    subjectId?: string;

    @IsInt()
    @Min(1)
    duration: number;

    @IsObject()
    settings: MatrixSettings;

    @IsInt()
    @Min(0)
    totalMcqCount: number;

    @IsInt()
    @Min(0)
    totalGroupCount: number;

    @IsInt()
    @Min(0)
    @IsOptional()
    totalShortAnswerCount?: number;

    @IsArray()
    @IsOptional()
    customQuestions?: CustomQuestionInput[];
}
