import { IsString, IsOptional, IsUUID, MaxLength, IsBoolean } from "class-validator";

export class CreateQuestionPoolDto {
    @IsString()
    @MaxLength(255)
    name: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsUUID("4")
    subjectId: string;

    /** Đánh dấu bộ câu hỏi dùng chung (chỉ HOD/ADMIN mới được set true) */
    @IsBoolean()
    @IsOptional()
    isPublic?: boolean;
}
