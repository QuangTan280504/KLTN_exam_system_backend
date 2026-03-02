import { Test, TestingModule } from '@nestjs/testing';
import { SubjectController } from './subject.controller';
import { SubjectService } from './subject.service';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

describe('SubjectController', () => {
    let controller: SubjectController;
    let service: SubjectService;

    const mockSubjectService = {
        create: jest.fn(),
        findAll: jest.fn(),
        findOne: jest.fn(),
        update: jest.fn(),
        remove: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [SubjectController],
            providers: [
                {
                    provide: SubjectService,
                    useValue: mockSubjectService,
                },
            ],
        })
            .overrideGuard(JwtAuthGuard)
            .useValue({ canActivate: () => true })
            .overrideGuard(RolesGuard)
            .useValue({ canActivate: () => true })
            .compile();

        controller = module.get<SubjectController>(SubjectController);
        service = module.get<SubjectService>(SubjectService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('create', () => {
        it('should call service.create with correct data', async () => {
            const dto: CreateSubjectDto = { name: 'Math', description: 'Mathematics' };
            const expectedResult = { id: '1', ...dto };
            mockSubjectService.create.mockResolvedValue(expectedResult);

            const result = await controller.create(dto);

            expect(service.create).toHaveBeenCalledWith(dto);
            expect(result).toEqual(expectedResult);
        });
    });

    describe('findAll', () => {
        it('should return an array of subjects', async () => {
            const expectedResult = [{ id: '1', name: 'Math' }];
            mockSubjectService.findAll.mockResolvedValue(expectedResult);

            const result = await controller.findAll();

            expect(service.findAll).toHaveBeenCalled();
            expect(result).toEqual(expectedResult);
        });
    });

    describe('findOne', () => {
        it('should return a single subject', async () => {
            const id = '1';
            const expectedResult = { id, name: 'Math' };
            mockSubjectService.findOne.mockResolvedValue(expectedResult);

            const result = await controller.findOne(id);

            expect(service.findOne).toHaveBeenCalledWith(id);
            expect(result).toEqual(expectedResult);
        });
    });

    describe('update', () => {
        it('should call service.update with correct data', async () => {
            const id = '1';
            const dto: UpdateSubjectDto = { name: 'Math Advanced' };
            const expectedResult = { id, ...dto };
            mockSubjectService.update.mockResolvedValue(expectedResult);

            const result = await controller.update(id, dto);

            expect(service.update).toHaveBeenCalledWith(id, dto);
            expect(result).toEqual(expectedResult);
        });
    });

    describe('remove', () => {
        it('should call service.remove and return undefined', async () => {
            const id = '1';
            mockSubjectService.remove.mockResolvedValue(undefined);

            const result = await controller.remove(id);

            expect(service.remove).toHaveBeenCalledWith(id);
            expect(result).toBeUndefined();
        });
    });
});
