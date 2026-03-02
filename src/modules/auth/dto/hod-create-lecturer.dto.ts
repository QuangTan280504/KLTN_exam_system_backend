/**
 * DTO tạo giáo viên bởi Tổ trưởng bộ môn
 * Giống CreateLecturerDto nhưng dùng riêng cho HOD
 */
import { IsString, IsNotEmpty, IsOptional } from "class-validator";
import { REGEX } from "src/constants";
import { ApiProperty } from "@nestjs/swagger";

export class HodCreateLecturerDto {
    @ApiProperty({ example: "Nguyễn Văn A", description: "Họ tên giáo viên" })
    @IsString()
    @IsNotEmpty({ message: "Họ tên không được để trống" })
    fullName: string;

    @ApiProperty({ example: "giaovien@example.com", description: "Địa chỉ email" })
    @IsNotEmpty({ message: "Email không được để trống" })
    email: string;

    @ApiProperty({
        example: "0123456789",
        description: "Số điện thoại (tuỳ chọn)",
        required: false,
    })
    @IsOptional()
    @IsString()
    phone?: string;
}
