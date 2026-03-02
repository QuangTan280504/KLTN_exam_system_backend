import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
    @ApiProperty({
        example: 'admin',
        description: 'Username, Email, or Phone number'
    })
    @IsString()
    @IsNotEmpty()
    identifier: string;

    @ApiProperty({ example: 'Admin@123', description: 'Password' })
    @IsString()
    @IsNotEmpty()
    password: string;
}
