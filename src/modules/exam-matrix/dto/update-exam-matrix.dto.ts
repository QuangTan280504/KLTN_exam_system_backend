import { PartialType } from "@nestjs/mapped-types";
import { IsArray, IsOptional } from "class-validator";
import { CreateExamMatrixDto } from "./create-exam-matrix.dto";
import { UpdateQuestionInput } from "../interfaces/matrix-settings.interface";

export class UpdateExamMatrixDto extends PartialType(CreateExamMatrixDto) {
    @IsArray()
    @IsOptional()
    updateQuestions?: UpdateQuestionInput[];
}
