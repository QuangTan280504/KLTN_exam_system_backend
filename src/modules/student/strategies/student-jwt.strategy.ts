/**
 * JWT Strategy cho Học sinh
 * Tách riêng với Admin/Lecturer strategy để phân biệt token
 */
import { ExtractJwt, Strategy } from "passport-jwt";
import { PassportStrategy } from "@nestjs/passport";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { StudentService } from "../student.service";

@Injectable()
export class StudentJwtStrategy extends PassportStrategy(Strategy, "student-jwt") {
    constructor(
        private configService: ConfigService,
        private studentService: StudentService,
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: configService.get("JWT_SECRET") || "exam-system-secret-key-change-in-production",
        });
    }

    async validate(payload: any) {
        // Chỉ chấp nhận token có type = 'student'
        if (payload.type !== "student") {
            throw new UnauthorizedException("Token không hợp lệ cho học sinh");
        }

        const student = await this.studentService.validateStudent(payload.sub);
        if (!student) {
            throw new UnauthorizedException("Học sinh không tồn tại");
        }

        return {
            studentId: payload.sub,
            username: payload.username,
            role: "STUDENT",
        };
    }
}
