/**
 * DTO đăng nhập học sinh bằng username/password
 */
import { IsString, IsNotEmpty } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class StudentLoginDto {
    @ApiProperty({ example: "hs001", description: "Tên đăng nhập hoặc mã học sinh" })
    @IsString()
    @IsNotEmpty({ message: "Tên đăng nhập không được để trống" })
    username: string;

    @ApiProperty({ example: "123456789", description: "Mật khẩu" })
    @IsString()
    @IsNotEmpty({ message: "Mật khẩu không được để trống" })
    password: string;
}
