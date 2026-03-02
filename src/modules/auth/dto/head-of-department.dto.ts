import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";
import { REGEX } from "src/constants";

export class CreateHeadOfDepartmentDto {
    @ApiProperty({ example: "Nguyễn Văn A", description: "Full name of the head of department" })
    @IsString()
    @IsNotEmpty()
    fullName: string;

    @ApiProperty({ example: "head-of-department@example.com", description: "Email address" })
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
