import { Test, TestingModule } from '@nestjs/testing';
import { RolesGuard } from './roles.guard';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';

describe('RolesGuard', () => {
    let guard: RolesGuard;
    let reflector: Reflector;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                RolesGuard,
                {
                    provide: Reflector,
                    useValue: {
                        getAllAndOverride: jest.fn(),
                    },
                },
            ],
        }).compile();

        guard = module.get<RolesGuard>(RolesGuard);
        reflector = module.get<Reflector>(Reflector);
    });

    it('should be defined', () => {
        expect(guard).toBeDefined();
    });

    describe('canActivate', () => {
        let mockContext: any;

        beforeEach(() => {
            mockContext = {
                getHandler: jest.fn(),
                getClass: jest.fn(),
                switchToHttp: jest.fn().mockReturnValue({
                    getRequest: jest.fn().mockReturnValue({
                        user: { role: 'LECTURER' },
                    }),
                }),
            };
        });

        it('should return true if no roles are required', () => {
            jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(null);
            expect(guard.canActivate(mockContext)).toBe(true);
        });

        it('should return true if user has the required role', () => {
            jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN', 'LECTURER']);
            expect(guard.canActivate(mockContext)).toBe(true);
        });

        it('should return false if user does not have the required role', () => {
            jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN']);
            expect(guard.canActivate(mockContext)).toBe(false);
        });

        it('should allow ADMIN even if only ADMIN is required', () => {
            mockContext.switchToHttp().getRequest().user.role = 'ADMIN';
            jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN']);
            expect(guard.canActivate(mockContext)).toBe(true);
        });
    });
});
