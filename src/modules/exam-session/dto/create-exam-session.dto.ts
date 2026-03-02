import { IsString, IsUUID, IsDate, IsInt, Min, IsEnum, IsOptional, IsBoolean } from "class-validator";
import { Type } from "class-transformer";
import { SessionStatus } from "../enums/session-status.enum";

export class CreateExamSessionDto {
    @IsString()
    name: string;

    @IsUUID("4")
    matrixId: string;

    @IsDate()
    @Type(() => Date)
    startTime: Date;

    @IsDate()
    @Type(() => Date)
    endTime: Date;

    @IsInt()
    @Min(1)
    durationMinutes: number;

    @IsEnum(SessionStatus)
    @IsOptional()
    status?: SessionStatus;

    /** Lớp áp dụng cho ca thi — khớp student.className */
    @IsString()
    @IsOptional()
    className?: string;

    /** Cho xem điểm sau khi nộp bài */
    @IsBoolean()
    @IsOptional()
    showScore?: boolean;
}
