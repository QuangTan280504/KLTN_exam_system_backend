import { Controller, Get, Post, Body, Patch, Param, Delete, HttpCode, HttpStatus, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { SubjectService } from "./subject.service";
import { CreateSubjectDto } from "./dto/create-subject.dto";
import { UpdateSubjectDto } from "./dto/update-subject.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";

@ApiTags("subjects")
@ApiBearerAuth("access-token")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN", "LECTURER", "HEAD_OF_DEPARTMENT")
@Controller("subjects")
export class SubjectController {
    constructor(private readonly subjectService: SubjectService) {}

    @Post()
    create(@Body() createSubjectDto: CreateSubjectDto) {
        return this.subjectService.create(createSubjectDto);
    }

    @Get()
    findAll() {
        return this.subjectService.findAll();
    }

    @Get(":id")
    findOne(@Param("id") id: string) {
        return this.subjectService.findOne(id);
    }

    @Patch(":id")
    update(@Param("id") id: string, @Body() updateSubjectDto: UpdateSubjectDto) {
        return this.subjectService.update(id, updateSubjectDto);
    }

    @Delete(":id")
    @HttpCode(HttpStatus.NO_CONTENT)
    remove(@Param("id") id: string) {
        return this.subjectService.remove(id);
    }
}
