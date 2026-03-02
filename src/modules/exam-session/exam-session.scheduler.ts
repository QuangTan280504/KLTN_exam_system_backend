import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, LessThan, In } from "typeorm";
import { ExamSession } from "./entities/exam-session.entity";
import { StudentExam } from "../student-exam/entities/student-exam.entity";
import { SessionStatus } from "./enums/session-status.enum";
import { StudentExamStatus } from "../student-exam/enums/student-exam-status.enum";

@Injectable()
export class ExamSessionScheduler {
    private readonly logger = new Logger(ExamSessionScheduler.name);

    constructor(
        @InjectRepository(ExamSession)
        private sessionRepository: Repository<ExamSession>,
        @InjectRepository(StudentExam)
        private studentExamRepository: Repository<StudentExam>,
    ) {}

    @Cron(CronExpression.EVERY_MINUTE)
    async handleCron() {
        const now = new Date();

        // Tìm các session sắp đóng (ACTIVE + hết giờ)
        const expiredSessions = await this.sessionRepository.find({
            where: {
                status: SessionStatus.ACTIVE,
                endTime: LessThan(now),
            },
        });

        if (expiredSessions.length === 0) return;

        // Chuyển session → FINISHED
        const result = await this.sessionRepository.update({ id: In(expiredSessions.map((s) => s.id)) }, { status: SessionStatus.FINISHED });

        /**
         * Đánh dấu HS vắng thi → ABSENT.
         * Định nghĩa VẮNG THI:
         *  - REGISTERED: Được gán vào ca thi nhưng không bao giờ bắt đầu làm bài
         *  - IN_PROGRESS: Đã bắt đầu nhưng không nộp bài trước khi hết giờ
         * Cả 2 trường hợp đều chuyển thành ABSENT khi session FINISHED.
         */
        for (const session of expiredSessions) {
            const absentResult = await this.studentExamRepository.update(
                {
                    sessionId: session.id,
                    status: In([StudentExamStatus.REGISTERED, StudentExamStatus.IN_PROGRESS]),
                },
                { status: StudentExamStatus.ABSENT },
            );

            if (absentResult.affected && absentResult.affected > 0) {
                this.logger.log(`Marked ${absentResult.affected} students as ABSENT in session ${session.id}`);
            }
        }

        if (result.affected && result.affected > 0) {
            this.logger.log(`Auto-closed ${result.affected} expired exam sessions at ${now.toISOString()}`);
        }
    }
}
