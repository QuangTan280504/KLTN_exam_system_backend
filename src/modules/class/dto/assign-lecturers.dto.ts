/**
 * DTO gán giáo viên vào lớp học
 */
import { IsString, IsNotEmpty, IsArray, ArrayNotEmpty } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class AssignLecturersDto {
    @ApiProperty({
        example: ["uuid-1", "uuid-2"],
        description: "Danh sách ID giáo viên cần gán vào lớp",
        type: [String],
    })
    @IsArray()
    @ArrayNotEmpty({ message: "Danh sách giáo viên không được rỗng" })
    @IsString({ each: true })
    lecturerIds: string[];
}
