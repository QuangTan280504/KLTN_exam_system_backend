import { IsString, IsNotEmpty, IsOptional, MinLength, Matches } from "class-validator";
import { REGEX } from "src/constants";
import { ApiProperty } from "@nestjs/swagger";

export class CreateLecturerDto {
    @ApiProperty({ example: "Nguyễn Văn A", description: "Full name of the lecturer" })
    @IsString()
    @IsNotEmpty()
    fullName: string;

    @ApiProperty({ example: "lecturer@example.com", description: "Email address" })
    @Matches(REGEX.EMAIL, { message: "Email không hợp lệ" })
    @IsNotEmpty()
    email: string;

    @ApiProperty({
        example: "0123456789",
        description: "Phone number (optional)",
        required: false,
    })
    @IsOptional()
    @IsString()
    phone?: string;
}
