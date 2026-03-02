import { Test, TestingModule } from '@nestjs/testing';
import { StudentExamController } from './student-exam.controller';
import { StudentExamService } from './student-exam.service';
import { StudentAnswers } from './interfaces/exam-snapshot.interface';

describe('StudentExamController', () => {
    let controller: StudentExamController;
    let service: StudentExamService;

    const mockStudentExamService = {
        loginWithAccessCode: jest.fn(),
        startExam: jest.fn(),
        submitExam: jest.fn(),
        getResult: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [StudentExamController],
            providers: [
                {
                    provide: StudentExamService,
                    useValue: mockStudentExamService,
                },
            ],
        }).compile();

        controller = module.get<StudentExamController>(StudentExamController);
        service = module.get<StudentExamService>(StudentExamService);
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('login', () => {
        it('should call service.loginWithAccessCode', async () => {
            const code = 'KEY123';
            mockStudentExamService.loginWithAccessCode.mockResolvedValue({ id: 'e1' });
            const result = await controller.login(code);
            expect(service.loginWithAccessCode).toHaveBeenCalledWith(code);
            expect(result).toEqual({ id: 'e1' });
        });
    });

    describe('startExam', () => {
        it('should call service.startExam', async () => {
            const id = 'e1';
            mockStudentExamService.startExam.mockResolvedValue({ part1: [] });
            const result = await controller.startExam(id);
            expect(service.startExam).toHaveBeenCalledWith(id);
            expect(result).toEqual({ part1: [] });
        });
    });

    describe('submitExam', () => {
        it('should call service.submitExam', async () => {
            const id = 'e1';
            const answers: StudentAnswers = { mcq_answers: [], group_answers: [] };
            mockStudentExamService.submitExam.mockResolvedValue({ score: 10 });
            const result = await controller.submitExam(id, answers);
            expect(service.submitExam).toHaveBeenCalledWith(id, answers);
            expect(result).toEqual({ score: 10 });
        });
    });

    describe('getResult', () => {
        it('should call service.getResult', async () => {
            const id = 'e1';
            mockStudentExamService.getResult.mockResolvedValue({ studentName: 'A', score: 9 });
            const result = await controller.getResult(id);
            expect(service.getResult).toHaveBeenCalledWith(id);
            expect(result.studentName).toBe('A');
        });
    });
});
