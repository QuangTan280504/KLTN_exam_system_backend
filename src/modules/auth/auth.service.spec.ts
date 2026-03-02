import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

const mockUserRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    remove: jest.fn(),
};

const mockJwtService = {
    sign: jest.fn(),
};

describe('AuthService', () => {
    let service: AuthService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                {
                    provide: getRepositoryToken(User),
                    useValue: mockUserRepository,
                },
                {
                    provide: JwtService,
                    useValue: mockJwtService,
                },
            ],
        }).compile();

        service = module.get<AuthService>(AuthService);
        jest.clearAllMocks();
    });

    describe('login', () => {
        const mockUser = {
            id: '1',
            username: 'admin',
            password: 'hashedPassword',
            email: 'admin@test.com',
            phone: '0123456789',
            role: 'ADMIN',
            isFirstLogin: false,
            fullName: 'Admin User',
        };

        it('should login successfully with username', async () => {
            const loginDto = { identifier: 'admin', password: 'password123' };
            mockUserRepository.findOne.mockResolvedValue(mockUser);
            (bcrypt.compare as jest.Mock).mockResolvedValue(true);
            mockJwtService.sign.mockReturnValue('mockToken');

            const result = await service.login(loginDto);

            expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { username: 'admin' } });
            expect(result.access_token).toBe('mockToken');
            expect(result.user.username).toBe('admin');
        });

        it('should login successfully with email', async () => {
            const loginDto = { identifier: 'admin@test.com', password: 'password123' };
            mockUserRepository.findOne.mockResolvedValue(mockUser);
            (bcrypt.compare as jest.Mock).mockResolvedValue(true);

            await service.login(loginDto);

            expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { email: 'admin@test.com' } });
        });

        it('should login successfully with phone number', async () => {
            const loginDto = { identifier: '0123456789', password: 'password123' };
            mockUserRepository.findOne.mockResolvedValue(mockUser);
            (bcrypt.compare as jest.Mock).mockResolvedValue(true);

            await service.login(loginDto);

            expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { phone: '0123456789' } });
        });

        it('should throw UnauthorizedException if user not found', async () => {
            const loginDto = { identifier: 'unknown', password: 'password123' };
            mockUserRepository.findOne.mockResolvedValue(null);

            await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
        });

        it('should throw UnauthorizedException if password invalid', async () => {
            const loginDto = { identifier: 'admin', password: 'wrongPassword' };
            mockUserRepository.findOne.mockResolvedValue(mockUser);
            (bcrypt.compare as jest.Mock).mockResolvedValue(false);

            await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
        });
    });

    describe('forceChangePassword', () => {
        it('should change password successfully on first login', async () => {
            const mockUser = { id: '1', isFirstLogin: true, password: 'old' };
            mockUserRepository.findOne.mockResolvedValue(mockUser);
            (bcrypt.hash as jest.Mock).mockResolvedValue('newHashed');
            mockUserRepository.save.mockResolvedValue({ ...mockUser, isFirstLogin: false, password: 'newHashed' });

            const result = await service.forceChangePassword('1', 'newPassword');

            expect(result.message).toBe('Đổi mật khẩu thành công');
            expect(mockUser.isFirstLogin).toBe(false);
            expect(mockUserRepository.save).toHaveBeenCalled();
        });

        it('should throw error if not first login', async () => {
            const mockUser = { id: '1', isFirstLogin: false };
            mockUserRepository.findOne.mockResolvedValue(mockUser);

            await expect(service.forceChangePassword('1', 'newPassword')).rejects.toThrow(UnauthorizedException);
        });
    });

    describe('createLecturer', () => {
        it('should create a lecturer with default settings', async () => {
            mockUserRepository.findOne.mockResolvedValue(null);
            (bcrypt.hash as jest.Mock).mockResolvedValue('hashedDefault');
            const lecturerData = { fullName: 'Lecturer A', email: 'a@test.com', phone: '0987654321' };

            mockUserRepository.create.mockReturnValue({ ...lecturerData, role: 'LECTURER', isFirstLogin: true });
            mockUserRepository.save.mockImplementation(u => Promise.resolve(u));

            const result = await service.createLecturer(lecturerData.fullName, lecturerData.email, lecturerData.phone);

            expect(result.role).toBe('LECTURER');
            expect(result.isFirstLogin).toBe(true);
            expect(mockUserRepository.save).toHaveBeenCalled();
        });
    });
});
