/**
 * DTO tạo lớp học mới
 * Dùng bởi Tổ trưởng bộ môn (HOD)
 */
import { IsString, IsNotEmpty, IsOptional } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateClassDto {
    @ApiProperty({ example: "10A1", description: "Tên lớp học" })
    @IsString()
    @IsNotEmpty({ message: "Tên lớp học không được để trống" })
    name: string;

    @ApiProperty({ example: "10", description: "Khối lớp", required: false })
    @IsOptional()
    @IsString()
    grade?: string;

    @ApiProperty({ example: "Lớp chuyên Toán", description: "Mô tả lớp học", required: false })
    @IsOptional()
    @IsString()
    description?: string;
}
