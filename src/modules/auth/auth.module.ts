import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AuthController } from "./auth.controller";
import { LecturerController } from "./lecturer.controller";
import { HodController } from "./hod.controller";
import { AuthService } from "./auth.service";
import { User } from "./entities/user.entity";
import { Class } from "../class/entities/class.entity";
import { JwtStrategy } from "./strategies/jwt.strategy";

@Module({
    imports: [
        TypeOrmModule.forFeature([User, Class]),
        PassportModule,
        JwtModule.registerAsync({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => ({
                secret: configService.get("JWT_SECRET") || "exam-system-secret-key-change-in-production",
                signOptions: { expiresIn: "24h" },
            }),
            inject: [ConfigService],
        }),
    ],
    controllers: [AuthController, LecturerController, HodController],
    providers: [AuthService, JwtStrategy],
    exports: [AuthService],
})
export class AuthModule {}
