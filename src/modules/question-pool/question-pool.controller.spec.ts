import { Test, TestingModule } from '@nestjs/testing';
import { QuestionPoolController } from './question-pool.controller';
import { QuestionPoolService } from './question-pool.service';
import { QuestionImportService } from './services/question-import.service';
import { CreateQuestionPoolDto } from './dto/create-question-pool.dto';
import { UpdateQuestionPoolDto } from './dto/update-question-pool.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

describe('QuestionPoolController', () => {
    let controller: QuestionPoolController;
    let service: QuestionPoolService;
    let importService: QuestionImportService;

    const mockQuestionPoolService = {
        create: jest.fn(),
        findAll: jest.fn(),
        findOne: jest.fn(),
        update: jest.fn(),
        remove: jest.fn(),
        getQuestionCount: jest.fn(),
    };

    const mockQuestionImportService = {
        importFromExcel: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [QuestionPoolController],
            providers: [
                {
                    provide: QuestionPoolService,
                    useValue: mockQuestionPoolService,
                },
                {
                    provide: QuestionImportService,
                    useValue: mockQuestionImportService,
                },
            ],
        })
            .overrideGuard(JwtAuthGuard)
            .useValue({ canActivate: () => true })
            .overrideGuard(RolesGuard)
            .useValue({ canActivate: () => true })
            .compile();

        controller = module.get<QuestionPoolController>(QuestionPoolController);
        service = module.get<QuestionPoolService>(QuestionPoolService);
        importService = module.get<QuestionImportService>(QuestionImportService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('importQuestions', () => {
        it('should call importService.importFromExcel', async () => {
            const id = 'pool1';
            const mockFile = { buffer: Buffer.from('test') } as any;
            const expectedResult = { success: true, count: 5 };
            mockQuestionImportService.importFromExcel.mockResolvedValue(expectedResult);

            const result = await controller.importQuestions(id, mockFile);

            expect(importService.importFromExcel).toHaveBeenCalledWith(id, mockFile.buffer);
            expect(result).toEqual(expectedResult);
        });
    });

    describe('create', () => {
        it('should call service.create', async () => {
            const dto: CreateQuestionPoolDto = { name: 'Pool 1', description: 'Desc', subjectId: 'sub1' };
            const expectedResult = { id: 'pool1', ...dto };
            mockQuestionPoolService.create.mockResolvedValue(expectedResult);

            const result = await controller.create(dto);

            expect(service.create).toHaveBeenCalledWith(dto);
            expect(result).toEqual(expectedResult);
        });
    });

    describe('findAll', () => {
        it('should call service.findAll with subjectId', async () => {
            const subjectId = 'sub1';
            const expectedResult = [{ id: 'pool1', name: 'Pool 1' }];
            mockQuestionPoolService.findAll.mockResolvedValue(expectedResult);

            const result = await controller.findAll(subjectId);

            expect(service.findAll).toHaveBeenCalledWith(subjectId);
            expect(result).toEqual(expectedResult);
        });
    });

    describe('findOne', () => {
        it('should call service.findOne', async () => {
            const id = 'pool1';
            const expectedResult = { id, name: 'Pool 1' };
            mockQuestionPoolService.findOne.mockResolvedValue(expectedResult);

            const result = await controller.findOne(id);

            expect(service.findOne).toHaveBeenCalledWith(id);
            expect(result).toEqual(expectedResult);
        });
    });

    describe('getStats', () => {
        it('should return question count', async () => {
            const id = 'pool1';
            mockQuestionPoolService.getQuestionCount.mockResolvedValue(10);

            const result = await controller.getStats(id);

            expect(service.getQuestionCount).toHaveBeenCalledWith(id);
            expect(result).toEqual({ questionCount: 10 });
        });
    });

    describe('update', () => {
        it('should call service.update', async () => {
            const id = 'pool1';
            const dto: UpdateQuestionPoolDto = { name: 'Pool 1 Update' };
            const expectedResult = { id, ...dto };
            mockQuestionPoolService.update.mockResolvedValue(expectedResult);

            const result = await controller.update(id, dto);

            expect(service.update).toHaveBeenCalledWith(id, dto);
            expect(result).toEqual(expectedResult);
        });
    });

    describe('remove', () => {
        it('should call service.remove', async () => {
            const id = 'pool1';
            mockQuestionPoolService.remove.mockResolvedValue(undefined);

            const result = await controller.remove(id);

            expect(service.remove).toHaveBeenCalledWith(id);
            expect(result).toBeUndefined();
        });
    });
});
