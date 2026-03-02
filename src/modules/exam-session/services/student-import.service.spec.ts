import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { StudentImportService } from './student-import.service';
import { Student } from '../../student/entities/student.entity';
import { StudentExam } from '../../student-exam/entities/student-exam.entity';
import { ExamSession } from '../entities/exam-session.entity';
import { BadRequestException } from '@nestjs/common';

// Mock ExcelJS since we don't want to deal with binary files in unit tests
jest.mock('exceljs', () => {
    return {
        Workbook: jest.fn().mockImplementation(() => ({
            xlsx: { load: jest.fn().mockResolvedValue(undefined) },
            worksheets: [{
                name: 'Sheet1',
                rowCount: 2,
                eachRow: jest.fn((callback) => {
                    // Mock one header row and one data row
                    callback({ getCell: (i) => ({ value: i === 1 ? 'SV001' : (i === 2 ? 'Nguyen Van A' : (i === 4 ? 'Class A' : '')) }) }, 1); // Header
                    callback({ getCell: (i) => ({ value: i === 1 ? 'SV001' : (i === 2 ? 'Nguyen Van A' : (i === 4 ? 'Class A' : '1/1/2000')) }), value: i => i === 3 ? new Date('2000-01-01') : null }, 2); // Data (simplified)
                }),
            }],
        })),
    };
});

describe('StudentImportService', () => {
    let service: StudentImportService;
    let studentRepo;
    let examRepo;
    let sessionRepo;

    beforeEach(async () => {
        const mockStudentRepo = {
            findOne: jest.fn(),
            create: jest.fn(d => ({ ...d, id: 'sid1' })),
            save: jest.fn(d => d),
        };

        const mockExamRepo = {
            find: jest.fn().mockResolvedValue([]),
            findOne: jest.fn(),
            create: jest.fn(d => d),
            save: jest.fn(d => d),
        };

        const mockSessionRepo = {
            findOne: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                StudentImportService,
                { provide: getRepositoryToken(Student), useValue: mockStudentRepo },
                { provide: getRepositoryToken(StudentExam), useValue: mockExamRepo },
                { provide: getRepositoryToken(ExamSession), useValue: mockSessionRepo },
            ],
        }).compile();

        service = module.get<StudentImportService>(StudentImportService);
        studentRepo = module.get(getRepositoryToken(Student));
        examRepo = module.get(getRepositoryToken(StudentExam));
        sessionRepo = module.get(getRepositoryToken(ExamSession));
    });

    it('should import students successfully', async () => {
        sessionRepo.findOne.mockResolvedValue({ id: 'session1', startTime: new Date(), endTime: new Date() });
        studentRepo.findOne.mockResolvedValue(null); // New student
        examRepo.findOne.mockResolvedValue(null);    // No existing exam
        examRepo.find.mockResolvedValue([]);         // No overlaps

        const result = await service.importFromExcel('session1', Buffer.from('mock'));

        expect(result.successCount).toBe(1);
        expect(studentRepo.save).toHaveBeenCalled();
        expect(examRepo.save).toHaveBeenCalled();
        expect(result.results[0].status).toBe('SUCCESS');
    });

    it('should detect duplicate students in the same session', async () => {
        sessionRepo.findOne.mockResolvedValue({ id: 'session1', startTime: new Date(), endTime: new Date() });
        studentRepo.findOne.mockResolvedValue({ id: 'sid1', studentCode: 'SV001' });
        examRepo.findOne.mockResolvedValue({ id: 'eid1' }); // Already registered
        examRepo.find.mockResolvedValue([]);

        const result = await service.importFromExcel('session1', Buffer.from('mock'));

        expect(result.successCount).toBe(0);
        expect(result.duplicateCount).toBe(1);
        expect(result.results[0].status).toBe('DUPLICATE');
    });
});
