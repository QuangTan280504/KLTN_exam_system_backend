import { Test, TestingModule } from '@nestjs/testing';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

describe('ReportController', () => {
    let controller: ReportController;
    let service: ReportService;

    const mockReportService = {
        getDashboardStats: jest.fn(),
        exportScoreSheet: jest.fn(),
        exportAuditLog: jest.fn(),
        getStudentExamDetail: jest.fn(),
        exportStudentExamDetail: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [ReportController],
            providers: [
                {
                    provide: ReportService,
                    useValue: mockReportService,
                },
            ],
        })
            .overrideGuard(JwtAuthGuard)
            .useValue({ canActivate: () => true })
            .overrideGuard(RolesGuard)
            .useValue({ canActivate: () => true })
            .compile();

        controller = module.get<ReportController>(ReportController);
        service = module.get<ReportService>(ReportService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('getDashboardStats', () => {
        it('should call service.getDashboardStats', async () => {
            mockReportService.getDashboardStats.mockResolvedValue({ subjectsCount: 5 });
            const result = await controller.getDashboardStats();
            expect(service.getDashboardStats).toHaveBeenCalled();
            expect(result.subjectsCount).toBe(5);
        });
    });

    describe('getStudentExamDetail', () => {
        it('should call service.getStudentExamDetail', async () => {
            const id = 'e1';
            mockReportService.getStudentExamDetail.mockResolvedValue({ id });
            await controller.getStudentExamDetail(id);
            expect(service.getStudentExamDetail).toHaveBeenCalledWith(id);
        });
    });
});
