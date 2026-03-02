/**
 * DTO cập nhật thông tin học sinh
 */
import { IsString, IsOptional, IsDateString } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateStudentDto {
    @ApiPropertyOptional({ example: "Nguyễn Văn B" })
    @IsString()
    @IsOptional()
    fullName?: string;

    @ApiPropertyOptional({ example: "10A2" })
    @IsString()
    @IsOptional()
    className?: string;

    @ApiPropertyOptional({ example: "2010-01-15" })
    @IsDateString()
    @IsOptional()
    dateOfBirth?: string;
}
