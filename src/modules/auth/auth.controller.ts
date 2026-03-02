import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ForceChangePasswordDto } from './dto/force-change-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Post('login')
    @ApiOperation({ summary: 'Admin/Lecturer login (username/email/phone)' })
    @ApiResponse({ status: 200, description: 'Login successful' })
    @ApiResponse({ status: 401, description: 'Invalid credentials' })
    async login(@Body() loginDto: LoginDto) {
        return this.authService.login(loginDto);
    }

    @Get('profile')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('access-token')
    @ApiOperation({ summary: 'Get current user profile' })
    @ApiResponse({ status: 200, description: 'User profile returned' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    getProfile(@Request() req) {
        return req.user;
    }

    @Post('change-password')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('access-token')
    @ApiOperation({ summary: 'Change password (requires old password)' })
    async changePassword(@Request() req, @Body() body: any) {
        const { oldPassword, newPassword } = body;
        return this.authService.changePassword(req.user.userId, oldPassword, newPassword);
    }

    @Post('force-change-password')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('access-token')
    @ApiOperation({ summary: 'Force change password on first login (no old password required)' })
    @ApiResponse({ status: 200, description: 'Password changed successfully' })
    @ApiResponse({ status: 401, description: 'Not first login or unauthorized' })
    async forceChangePassword(@Request() req, @Body() forceChangePasswordDto: ForceChangePasswordDto) {
        return this.authService.forceChangePassword(req.user.userId, forceChangePasswordDto.newPassword);
    }
}
