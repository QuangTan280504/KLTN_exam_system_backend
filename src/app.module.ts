import { Module, OnModuleInit } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { SubjectModule } from "./modules/subject/subject.module";
import { QuestionPoolModule } from "./modules/question-pool/question-pool.module";
import { QuestionModule } from "./modules/question/question.module";
import { ExamMatrixModule } from "./modules/exam-matrix/exam-matrix.module";
import { ExamSessionModule } from "./modules/exam-session/exam-session.module";
import { StudentExamModule } from "./modules/student-exam/student-exam.module";
import { ReportModule } from "./modules/report/report.module";
import { ClassModule } from "./modules/class/class.module";
import { AuthModule } from "./modules/auth/auth.module";
import { AuthService } from "./modules/auth/auth.service";
import { StudentModule } from "./modules/student/student.module";
import { SharedModule } from "./shared/shared.module";

import { ScheduleModule } from "@nestjs/schedule";

@Module({
    imports: [
        ScheduleModule.forRoot(),
        SharedModule,
        ConfigModule.forRoot({
            isGlobal: true,
        }),
        TypeOrmModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: (configService: ConfigService) => ({
                type: "postgres",
                host: configService.get("DB_HOST", "localhost"),
                port: configService.get("DB_PORT", 5432),
                username: configService.get("DB_USER", "exam_user"),
                password: configService.get("DB_PASSWORD", "exam_pass"),
                database: configService.get("DB_NAME", "exam_system"),
                autoLoadEntities: true,
                synchronize: configService.get("NODE_ENV") === "development",
            }),
            inject: [ConfigService],
        }),
        AuthModule,
        SubjectModule,
        QuestionPoolModule,
        QuestionModule,
        ExamMatrixModule,
        ExamSessionModule,
        StudentExamModule,
        ReportModule,
        ClassModule,
        StudentModule,
    ],
})
export class AppModule implements OnModuleInit {
    constructor(private authService: AuthService) {}

    async onModuleInit() {
        // Seed admin user on first run
        try {
            await this.authService.createUser("admin", "Admin@123", "Quản trị hệ thống", "ADMIN");
            console.log("✅ Default admin user created: username=admin, password=Admin@123");
        } catch (error) {
            // User already exists, ignore
            console.log("ℹ️  Admin user already exists");
        }
    }
}
