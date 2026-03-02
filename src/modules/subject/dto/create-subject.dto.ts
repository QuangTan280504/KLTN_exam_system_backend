import { IsString, IsOptional, MaxLength } from 'class-validator';

export class CreateSubjectDto {
    @IsString()
    @MaxLength(255)
    name: string;

    @IsString()
    @IsOptional()
    @MaxLength(50)
    code?: string;

    @IsString()
    @IsOptional()
    description?: string;
}
