import { Test, TestingModule } from '@nestjs/testing';
import { LecturerController } from './lecturer.controller';
import { AuthService } from './auth.service';
import { CreateLecturerDto } from './dto/create-lecturer.dto';
import { UpdateLecturerDto } from './dto/update-lecturer.dto';

const mockAuthService = {
    createLecturer: jest.fn(),
    getAllLecturers: jest.fn(),
    getLecturerById: jest.fn(),
    updateLecturer: jest.fn(),
    deleteLecturer: jest.fn(),
    resetLecturerPassword: jest.fn(),
};

describe('LecturerController', () => {
    let controller: LecturerController;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [LecturerController],
            providers: [
                {
                    provide: AuthService,
                    useValue: mockAuthService,
                },
            ],
        }).compile();

        controller = module.get<LecturerController>(LecturerController);
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('createLecturer', () => {
        it('should create a lecturer', async () => {
            const dto: CreateLecturerDto = { fullName: 'Test', email: 'test@test.com', phone: '0123456789' };
            const expectedResult = { id: '1', ...dto, role: 'LECTURER' };
            mockAuthService.createLecturer.mockResolvedValue(expectedResult);

            const result = await controller.createLecturer(dto);

            expect(mockAuthService.createLecturer).toHaveBeenCalledWith(dto.fullName, dto.email, dto.phone);
            expect(result.lecturer.fullName).toBe('Test');
            expect(result.defaultPassword).toBe('123456789');
        });
    });

    describe('getAllLecturers', () => {
        it('should return all lecturers', async () => {
            const lecturers = [{ id: '1', fullName: 'Lecturer 1' }];
            mockAuthService.getAllLecturers.mockResolvedValue(lecturers);

            const result = await controller.getAllLecturers();

            expect(mockAuthService.getAllLecturers).toHaveBeenCalled();
            expect(result).toEqual(lecturers);
        });
    });

    describe('getLecturerById', () => {
        it('should return a lecturer by id', async () => {
            const lecturer = { id: '1', fullName: 'Lecturer 1' };
            mockAuthService.getLecturerById.mockResolvedValue(lecturer);

            const result = await controller.getLecturerById('1');

            expect(mockAuthService.getLecturerById).toHaveBeenCalledWith('1');
            expect(result.fullName).toBe('Lecturer 1');
        });
    });

    describe('updateLecturer', () => {
        it('should update a lecturer', async () => {
            const dto: UpdateLecturerDto = { fullName: 'Updated' };
            const updatedLecturer = { id: '1', fullName: 'Updated' };
            mockAuthService.updateLecturer.mockResolvedValue(updatedLecturer);

            const result = await controller.updateLecturer('1', dto);

            expect(mockAuthService.updateLecturer).toHaveBeenCalledWith('1', dto.fullName, dto.email, dto.phone);
            expect(result.lecturer.fullName).toBe('Updated');
        });
    });

    describe('deleteLecturer', () => {
        it('should delete a lecturer', async () => {
            mockAuthService.deleteLecturer.mockResolvedValue(undefined);

            const result = await controller.deleteLecturer('1');

            expect(mockAuthService.deleteLecturer).toHaveBeenCalledWith('1');
            expect(result.message).toContain('thành công');
        });
    });

    describe('resetPassword', () => {
        it('should reset lecturer password', async () => {
            mockAuthService.resetLecturerPassword.mockResolvedValue(undefined);

            const result = await controller.resetPassword('1');

            expect(mockAuthService.resetLecturerPassword).toHaveBeenCalledWith('1');
            expect(result.message).toContain('thành công');
            expect(result.defaultPassword).toBe('123456789');
        });
    });
});
