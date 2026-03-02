import { Test, TestingModule } from '@nestjs/testing';
import { QuestionController } from './question.controller';
import { QuestionService } from './question.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { QuestionType, CognitiveLevel } from './interfaces/question-data.interface';
import { BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

describe('QuestionController', () => {
    let controller: QuestionController;
    let service: QuestionService;

    const mockQuestionService = {
        create: jest.fn(),
        importFromExcel: jest.fn(),
        findByPool: jest.fn(),
        findOne: jest.fn(),
        update: jest.fn(),
        remove: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [QuestionController],
            providers: [
                {
                    provide: QuestionService,
                    useValue: mockQuestionService,
                },
            ],
        })
            .overrideGuard(JwtAuthGuard)
            .useValue({ canActivate: () => true })
            .overrideGuard(RolesGuard)
            .useValue({ canActivate: () => true })
            .compile();

        controller = module.get<QuestionController>(QuestionController);
        service = module.get<QuestionService>(QuestionService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('create', () => {
        it('should call service.create', async () => {
            const dto: CreateQuestionDto = {
                poolId: 'pool1',
                questionType: QuestionType.MCQ,
                content: 'Test',
                cognitiveLevel: CognitiveLevel.BIET,
                data: {} as any,
            };
            mockQuestionService.create.mockResolvedValue({ id: 'q1', ...dto });

            const result = await controller.create(dto);

            expect(service.create).toHaveBeenCalledWith(dto);
            expect(result.id).toBe('q1');
        });
    });

    describe('importFromExcel', () => {
        it('should call service.importFromExcel with file and poolId', async () => {
            const poolId = 'pool1';
            const mockFile = { buffer: Buffer.from('test') } as any;
            mockQuestionService.importFromExcel.mockResolvedValue({ success: true });

            const result = await controller.importFromExcel(mockFile, poolId);

            expect(service.importFromExcel).toHaveBeenCalledWith(poolId, mockFile);
            expect(result).toEqual({ success: true });
        });

        it('should throw BadRequestException if file is missing', async () => {
            await expect(controller.importFromExcel(null, 'pool1')).rejects.toThrow(BadRequestException);
        });

        it('should throw BadRequestException if poolId is missing', async () => {
            const mockFile = { buffer: Buffer.from('test') } as any;
            await expect(controller.importFromExcel(mockFile, '')).rejects.toThrow(BadRequestException);
        });
    });

    describe('findAll', () => {
        it('should call service.findByPool with parsed params', async () => {
            const poolId = 'pool1';
            const expectedResult = { items: [], total: 0 };
            mockQuestionService.findByPool.mockResolvedValue(expectedResult);

            const result = await controller.findAll(poolId, QuestionType.MCQ, '2', '1', '20');

            expect(service.findByPool).toHaveBeenCalledWith(
                poolId,
                QuestionType.MCQ,
                CognitiveLevel.HIEU,
                1,
                20,
            );
            expect(result).toEqual(expectedResult);
        });

        it('should throw BadRequestException if poolId is missing', () => {
            expect(() => controller.findAll('', undefined)).toThrow(BadRequestException);
        });
    });

    describe('findOne', () => {
        it('should call service.findOne', async () => {
            const id = 'q1';
            mockQuestionService.findOne.mockResolvedValue({ id });

            const result = await controller.findOne(id);

            expect(service.findOne).toHaveBeenCalledWith(id);
            expect(result.id).toBe(id);
        });
    });

    describe('update', () => {
        it('should call service.update', async () => {
            const id = 'q1';
            const dto: UpdateQuestionDto = { content: 'Updated' };
            mockQuestionService.update.mockResolvedValue({ id, ...dto });

            const result = await controller.update(id, dto);

            expect(service.update).toHaveBeenCalledWith(id, dto);
            expect(result.content).toBe('Updated');
        });
    });

    describe('remove', () => {
        it('should call service.remove', async () => {
            const id = 'q1';
            mockQuestionService.remove.mockResolvedValue(undefined);

            const result = await controller.remove(id);

            expect(service.remove).toHaveBeenCalledWith(id);
            expect(result).toBeUndefined();
        });
    });
});
