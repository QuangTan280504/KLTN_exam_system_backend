import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subject } from './entities/subject.entity';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';

@Injectable()
export class SubjectService {
    constructor(
        @InjectRepository(Subject)
        private subjectRepository: Repository<Subject>,
    ) { }

    async create(createSubjectDto: CreateSubjectDto): Promise<Subject> {
        const subject = this.subjectRepository.create(createSubjectDto);
        return await this.subjectRepository.save(subject);
    }

    async findAll(): Promise<Subject[]> {
        return await this.subjectRepository.find({
            order: { name: 'ASC' },
        });
    }

    async findOne(id: string): Promise<Subject> {
        const subject = await this.subjectRepository.findOne({ where: { id } });
        if (!subject) {
            throw new NotFoundException(`Subject with ID ${id} not found`);
        }
        return subject;
    }

    async update(id: string, updateSubjectDto: UpdateSubjectDto): Promise<Subject> {
        const subject = await this.findOne(id);
        Object.assign(subject, updateSubjectDto);
        return await this.subjectRepository.save(subject);
    }

    async remove(id: string): Promise<void> {
        const subject = await this.findOne(id);
        try {
            await this.subjectRepository.remove(subject);
        } catch (error) {
            if (error.code === '23503') { // Postgres ForeignKeyViolation
                throw new BadRequestException('Không thể xóa môn học này vì đã có dữ liệu liên quan (Gói câu hỏi, Ma trận đề, Ca thi,...).');
            }
            throw error;
        }
    }
}
