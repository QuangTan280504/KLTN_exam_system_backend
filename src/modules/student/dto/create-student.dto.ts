/**
 * DTO tạo tài khoản học sinh
 * Dùng cho GV tạo từng học sinh hoặc import hàng loạt
 */
import { IsString, IsNotEmpty, IsOptional, IsDateString } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateStudentDto {
    @ApiProperty({ example: "HS001", description: "Mã học sinh (unique)" })
    @IsString()
    @IsNotEmpty({ message: "Mã học sinh không được để trống" })
    studentCode: string;

    @ApiProperty({ example: "Nguyễn Văn A", description: "Họ tên học sinh" })
    @IsString()
    @IsNotEmpty({ message: "Họ tên không được để trống" })
    fullName: string;

    @ApiPropertyOptional({ example: "10A1", description: "Tên lớp" })
    @IsString()
    @IsOptional()
    className?: string;

    @ApiPropertyOptional({ example: "2010-01-15", description: "Ngày sinh" })
    @IsDateString()
    @IsOptional()
    dateOfBirth?: string;

    @ApiPropertyOptional({ example: "hs001", description: "Tên đăng nhập (mặc định = mã HS)" })
    @IsString()
    @IsOptional()
    username?: string;
}
