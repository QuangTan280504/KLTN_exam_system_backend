import { Test, TestingModule } from '@nestjs/testing';
import { ReportService } from './report.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { StudentExam } from '../student-exam/entities/student-exam.entity';
import { Question } from '../question/entities/question.entity';
import { Subject } from '../subject/entities/subject.entity';
import { ExamSession } from '../exam-session/entities/exam-session.entity';
import { Student } from '../student/entities/student.entity';
import { NotFoundException } from '@nestjs/common';

const createMockSheet = () => ({
    columns: [],
    getRow: jest.fn(() => ({ font: {}, alignment: {}, number: 1, eachCell: jest.fn() })),
    addRow: jest.fn(() => ({ font: {}, alignment: {}, number: 1, eachCell: jest.fn() })),
    mergeCells: jest.fn(),
    getColumn: jest.fn(() => ({ width: 0, alignment: {} })),
});

const mockWorkbook = {
    addWorksheet: jest.fn(() => createMockSheet()),
    xlsx: {
        writeBuffer: jest.fn().mockResolvedValue(Buffer.from('excel')),
    },
};

jest.mock('exceljs', () => ({
    Workbook: jest.fn().mockImplementation(() => mockWorkbook),
}));

describe('ReportService', () => {
    let service: ReportService;
    let studentExamRepo;
    let sessionRepo;
    let subjectRepo;
    let studentRepo;
    let questionRepo;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ReportService,
                { provide: getRepositoryToken(StudentExam), useValue: { find: jest.fn(), findOne: jest.fn(), count: jest.fn() } },
                { provide: getRepositoryToken(Question), useValue: { findByIds: jest.fn(), count: jest.fn() } },
                { provide: getRepositoryToken(Subject), useValue: { count: jest.fn() } },
                { provide: getRepositoryToken(ExamSession), useValue: { findOne: jest.fn(), count: jest.fn() } },
                { provide: getRepositoryToken(Student), useValue: { count: jest.fn() } },
            ],
        }).compile();

        service = module.get<ReportService>(ReportService);
        studentExamRepo = module.get(getRepositoryToken(StudentExam));
        sessionRepo = module.get(getRepositoryToken(ExamSession));
        subjectRepo = module.get(getRepositoryToken(Subject));
        studentRepo = module.get(getRepositoryToken(Student));
        questionRepo = module.get(getRepositoryToken(Question));
    });

    describe('getDashboardStats', () => {
        it('should return combined counts from repositories', async () => {
            subjectRepo.count.mockResolvedValue(10);
            sessionRepo.count.mockResolvedValue(5);
            studentRepo.count.mockResolvedValue(100);
            questionRepo.count.mockResolvedValue(500);

            const stats = await service.getDashboardStats();

            expect(stats).toEqual({
                subjectsCount: 10,
                questionsCount: 500,
                activeSessionsCount: 5,
                studentsCount: 100
            });
        });
    });

    describe('getStudentExamDetail', () => {
        it('should return detailed info if exam exists', async () => {
            const mockExam = {
                id: 'e1',
                student: { fullName: 'A', studentCode: 'S1' },
                status: 'SUBMITTED',
                score: 10,
                examSnapshot: { part1_mcq: [], part2_group: [] },
                studentAnswers: { mcq_answers: [], group_answers: [] }
            };
            studentExamRepo.findOne.mockResolvedValue(mockExam);
            questionRepo.findByIds.mockResolvedValue([]);

            const result = await service.getStudentExamDetail('e1');
            expect(result.info.studentName).toBe('A');
        });
    });

    describe('Excel Exports', () => {
        const mockStudentExams = [
            {
                student: { studentCode: 'S1', fullName: 'A' },
                examSnapshot: {
                    part1_mcq: [{
                        question_id: 'q1',
                        original_question_id: 'orig1',
                        options: [{ id: 'opt1', display_label: 'A', text: 'Ans' }]
                    }],
                    part2_group: []
                },
                studentAnswers: { mcq_answers: [{ question_id: 'q1', selected_option_id: 'opt1' }], group_answers: [] },
                score: 10
            }
        ];

        it('should generate score sheet buffer', async () => {
            sessionRepo.findOne.mockResolvedValue({ id: 's1', name: 'S1' });
            studentExamRepo.find.mockResolvedValue(mockStudentExams);
            const result = await service.exportScoreSheet('s1');
            expect(result.buffer).toBeDefined();
        });

        it('should generate audit log buffer', async () => {
            sessionRepo.findOne.mockResolvedValue({ id: 's1', name: 'S1' });
            studentExamRepo.find.mockResolvedValue(mockStudentExams);
            questionRepo.findByIds.mockResolvedValue([{ id: 'orig1', content: 'Q1', data: { options: [{ id: 'opt1', text: 'Ans' }] } }]);

            const result = await service.exportAuditLog('s1');
            expect(result.buffer).toBeDefined();
        });
    });
});
