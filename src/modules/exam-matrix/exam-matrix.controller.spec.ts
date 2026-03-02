import { Test, TestingModule } from '@nestjs/testing';
import { ExamMatrixController } from './exam-matrix.controller';
import { ExamMatrixService } from './exam-matrix.service';
import { CreateExamMatrixDto } from './dto/create-exam-matrix.dto';
import { UpdateExamMatrixDto } from './dto/update-exam-matrix.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

describe('ExamMatrixController', () => {
    let controller: ExamMatrixController;
    let service: ExamMatrixService;

    const mockExamMatrixService = {
        create: jest.fn(),
        findAll: jest.fn(),
        findOne: jest.fn(),
        update: jest.fn(),
        remove: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [ExamMatrixController],
            providers: [
                {
                    provide: ExamMatrixService,
                    useValue: mockExamMatrixService,
                },
            ],
        })
            .overrideGuard(JwtAuthGuard)
            .useValue({ canActivate: () => true })
            .overrideGuard(RolesGuard)
            .useValue({ canActivate: () => true })
            .compile();

        controller = module.get<ExamMatrixController>(ExamMatrixController);
        service = module.get<ExamMatrixService>(ExamMatrixService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('create', () => {
        it('should call service.create', async () => {
            const dto: CreateExamMatrixDto = { name: 'M1', subjectId: 's1', duration: 60, totalMcqCount: 10, totalGroupCount: 0, settings: {} as any };
            mockExamMatrixService.create.mockResolvedValue({ id: 'm1', ...dto });

            const result = await controller.create(dto);

            expect(service.create).toHaveBeenCalledWith(dto);
            expect(result.id).toBe('m1');
        });
    });

    describe('findAll', () => {
        it('should call service.findAll', async () => {
            mockExamMatrixService.findAll.mockResolvedValue([]);
            await controller.findAll();
            expect(service.findAll).toHaveBeenCalled();
        });
    });

    describe('findOne', () => {
        it('should call service.findOne', async () => {
            const id = 'm1';
            mockExamMatrixService.findOne.mockResolvedValue({ id });
            const result = await controller.findOne(id);
            expect(service.findOne).toHaveBeenCalledWith(id);
            expect(result.id).toBe(id);
        });
    });

    describe('update', () => {
        it('should call service.update', async () => {
            const id = 'm1';
            const dto: UpdateExamMatrixDto = { name: 'New' };
            mockExamMatrixService.update.mockResolvedValue({ id, ...dto });
            const result = await controller.update(id, dto);
            expect(service.update).toHaveBeenCalledWith(id, dto);
            expect(result.name).toBe('New');
        });
    });

    describe('remove', () => {
        it('should call service.remove', async () => {
            const id = 'm1';
            mockExamMatrixService.remove.mockResolvedValue(undefined);
            await controller.remove(id);
            expect(service.remove).toHaveBeenCalledWith(id);
        });
    });
});
