/**
 * Module quản lý Học sinh
 * Bao gồm: CRUD, auth (login/đổi MK), JWT strategy riêng
 */
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { PassportModule } from "@nestjs/passport";
import { Student } from "./entities/student.entity";
import { StudentExam } from "../student-exam/entities/student-exam.entity";
import { Class } from "../class/entities/class.entity";
import { StudentService } from "./student.service";
import { StudentController } from "./student.controller";
import { StudentAuthController } from "./student-auth.controller";
import { StudentJwtStrategy } from "./strategies/student-jwt.strategy";

@Module({
    imports: [
        TypeOrmModule.forFeature([Student, StudentExam, Class]),
        PassportModule,
        JwtModule.registerAsync({
            imports: [ConfigModule],
            useFactory: (configService: ConfigService) => ({
                secret: configService.get("JWT_SECRET") || "exam-system-secret-key-change-in-production",
                signOptions: { expiresIn: "8h" },
            }),
            inject: [ConfigService],
        }),
    ],
    controllers: [StudentController, StudentAuthController],
    providers: [StudentService, StudentJwtStrategy],
    exports: [TypeOrmModule, StudentService],
})
export class StudentModule {}
