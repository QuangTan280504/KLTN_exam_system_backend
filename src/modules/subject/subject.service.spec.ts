import { Test, TestingModule } from '@nestjs/testing';
import { SubjectService } from './subject.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Subject } from './entities/subject.entity';
import { NotFoundException } from '@nestjs/common';

const mockSubjectRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
};

describe('SubjectService', () => {
    let service: SubjectService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                SubjectService,
                {
                    provide: getRepositoryToken(Subject),
                    useValue: mockSubjectRepository,
                },
            ],
        }).compile();

        service = module.get<SubjectService>(SubjectService);
        jest.clearAllMocks();
    });

    describe('create', () => {
        it('should create a subject successfully', async () => {
            const dto = { name: 'Tin học', code: 'TH01', description: 'Môn tin học' };
            const savedSubject = { id: '1', ...dto, createdAt: new Date(), updatedAt: new Date() };

            mockSubjectRepository.create.mockReturnValue(dto);
            mockSubjectRepository.save.mockResolvedValue(savedSubject);

            const result = await service.create(dto);

            expect(mockSubjectRepository.create).toHaveBeenCalledWith(dto);
            expect(mockSubjectRepository.save).toHaveBeenCalledWith(dto);
            expect(result).toEqual(savedSubject);
        });
    });

    describe('findAll', () => {
        it('should return all subjects ordered by name', async () => {
            const subjects = [
                { id: '1', name: 'Lịch sử', code: 'LS01' },
                { id: '2', name: 'Tin học', code: 'TH01' },
            ];

            mockSubjectRepository.find.mockResolvedValue(subjects);

            const result = await service.findAll();

            expect(mockSubjectRepository.find).toHaveBeenCalledWith({
                order: { name: 'ASC' },
            });
            expect(result).toEqual(subjects);
        });
    });

    describe('findOne', () => {
        it('should return a subject by ID', async () => {
            const subject = { id: '1', name: 'Tin học', code: 'TH01' };
            mockSubjectRepository.findOne.mockResolvedValue(subject);

            const result = await service.findOne('1');

            expect(mockSubjectRepository.findOne).toHaveBeenCalledWith({ where: { id: '1' } });
            expect(result).toEqual(subject);
        });

        it('should throw NotFoundException when subject not found', async () => {
            mockSubjectRepository.findOne.mockResolvedValue(null);

            await expect(service.findOne('999')).rejects.toThrow(NotFoundException);
            await expect(service.findOne('999')).rejects.toThrow('Subject with ID 999 not found');
        });
    });

    describe('update', () => {
        it('should update a subject successfully', async () => {
            const existingSubject = { id: '1', name: 'Tin học', code: 'TH01' };
            const updateDto = { name: 'Tin học nâng cao' };
            const updatedSubject = { ...existingSubject, ...updateDto };

            mockSubjectRepository.findOne.mockResolvedValue(existingSubject);
            mockSubjectRepository.save.mockResolvedValue(updatedSubject);

            const result = await service.update('1', updateDto);

            expect(mockSubjectRepository.findOne).toHaveBeenCalledWith({ where: { id: '1' } });
            expect(mockSubjectRepository.save).toHaveBeenCalled();
            expect(result).toEqual(updatedSubject);
        });

        it('should throw NotFoundException when updating non-existent subject', async () => {
            mockSubjectRepository.findOne.mockResolvedValue(null);

            await expect(service.update('999', { name: 'Test' })).rejects.toThrow(NotFoundException);
        });
    });

    describe('remove', () => {
        it('should remove a subject successfully', async () => {
            const subject = { id: '1', name: 'Tin học', code: 'TH01' };
            mockSubjectRepository.findOne.mockResolvedValue(subject);
            mockSubjectRepository.remove.mockResolvedValue(subject);

            await service.remove('1');

            expect(mockSubjectRepository.findOne).toHaveBeenCalledWith({ where: { id: '1' } });
            expect(mockSubjectRepository.remove).toHaveBeenCalledWith(subject);
        });

        it('should throw NotFoundException when removing non-existent subject', async () => {
            mockSubjectRepository.findOne.mockResolvedValue(null);

            await expect(service.remove('999')).rejects.toThrow(NotFoundException);
        });
    });
});
