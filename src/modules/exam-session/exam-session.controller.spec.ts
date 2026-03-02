import { Test, TestingModule } from '@nestjs/testing';
import { ExamSessionController } from './exam-session.controller';
import { ExamSessionService } from './exam-session.service';
import { StudentImportService } from './services/student-import.service';
import { CreateExamSessionDto } from './dto/create-exam-session.dto';
import { UpdateExamSessionDto } from './dto/update-exam-session.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

describe('ExamSessionController', () => {
    let controller: ExamSessionController;
    let service: ExamSessionService;
    let importService: StudentImportService;

    const mockExamSessionService = {
        create: jest.fn(),
        findAll: jest.fn(),
        findOne: jest.fn(),
        update: jest.fn(),
        remove: jest.fn(),
        getStudentsInSession: jest.fn(),
        exportAccessCodes: jest.fn(),
    };

    const mockStudentImportService = {
        importFromExcel: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [ExamSessionController],
            providers: [
                {
                    provide: ExamSessionService,
                    useValue: mockExamSessionService,
                },
                {
                    provide: StudentImportService,
                    useValue: mockStudentImportService,
                },
            ],
        })
            .overrideGuard(JwtAuthGuard)
            .useValue({ canActivate: () => true })
            .overrideGuard(RolesGuard)
            .useValue({ canActivate: () => true })
            .compile();

        controller = module.get<ExamSessionController>(ExamSessionController);
        service = module.get<ExamSessionService>(ExamSessionService);
        importService = module.get<StudentImportService>(StudentImportService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('create', () => {
        it('should call service.create', async () => {
            const dto: CreateExamSessionDto = { name: 'S1', matrixId: 'm1', startTime: new Date(), endTime: new Date(), durationMinutes: 60 };
            mockExamSessionService.create.mockResolvedValue({ id: 's1', ...dto });
            const result = await controller.create(dto);
            expect(service.create).toHaveBeenCalledWith(dto);
            expect(result.id).toBe('s1');
        });
    });

    describe('importStudents', () => {
        it('should call studentImportService.importFromExcel', async () => {
            const id = 's1';
            const mockFile = { buffer: Buffer.from('test') } as any;
            const expectedResult = { success: true };
            mockStudentImportService.importFromExcel.mockResolvedValue(expectedResult);

            const result = await controller.importStudents(id, mockFile);

            expect(mockStudentImportService.importFromExcel).toHaveBeenCalledWith(id, mockFile.buffer);
            expect(result).toEqual(expectedResult);
        });
    });

    describe('exportAccessCodes', () => {
        it('should return buffer with correct headers', async () => {
            const id = 's1';
            const mockBuffer = Buffer.from('excel-data');
            mockExamSessionService.exportAccessCodes.mockResolvedValue(mockBuffer);

            const mockRes = {
                set: jest.fn(),
                end: jest.fn(),
            } as any;

            await controller.exportAccessCodes(id, mockRes);

            expect(service.exportAccessCodes).toHaveBeenCalledWith(id);
            expect(mockRes.set).toHaveBeenCalledWith(expect.objectContaining({
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            }));
            expect(mockRes.end).toHaveBeenCalledWith(mockBuffer);
        });
    });

    describe('findAll', () => {
        it('should call service.findAll', async () => {
            mockExamSessionService.findAll.mockResolvedValue([]);
            await controller.findAll();
            expect(service.findAll).toHaveBeenCalled();
        });
    });

    describe('update', () => {
        it('should call service.update', async () => {
            const id = 's1';
            const dto: UpdateExamSessionDto = { name: 'New' };
            mockExamSessionService.update.mockResolvedValue({ id, ...dto });
            const result = await controller.update(id, dto);
            expect(service.update).toHaveBeenCalledWith(id, dto);
            expect(result.name).toBe('New');
        });
    });

    describe('remove', () => {
        it('should call service.remove', async () => {
            const id = 's1';
            mockExamSessionService.remove.mockResolvedValue(undefined);
            await controller.remove(id);
            expect(service.remove).toHaveBeenCalledWith(id);
        });
    });
});
