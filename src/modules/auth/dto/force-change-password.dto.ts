import { IsString, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForceChangePasswordDto {
    @ApiProperty({
        example: 'NewSecurePassword@123',
        description: 'New password (minimum 6 characters)'
    })
    @IsString()
    @IsNotEmpty()
    @MinLength(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' })
    newPassword: string;
}
