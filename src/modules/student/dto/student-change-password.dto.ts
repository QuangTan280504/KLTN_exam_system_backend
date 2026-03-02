/**
 * DTO đổi mật khẩu học sinh
 */
import { IsString, IsNotEmpty, MinLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class StudentChangePasswordDto {
    @ApiProperty({ example: "NewPassword@123", description: "Mật khẩu mới (ít nhất 6 ký tự)" })
    @IsString()
    @IsNotEmpty({ message: "Mật khẩu mới không được để trống" })
    @MinLength(6, { message: "Mật khẩu phải có ít nhất 6 ký tự" })
    newPassword: string;
}
