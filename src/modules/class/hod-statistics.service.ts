/**
 * Service thống kê dành cho Tổ trưởng bộ môn (HOD)
 * Cung cấp dữ liệu thống kê: ca thi, điểm trung bình, giáo viên-lớp
 */
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Class } from "../class/entities/class.entity";
import { ExamSession } from "../exam-session/entities/exam-session.entity";
import { StudentExam } from "../student-exam/entities/student-exam.entity";
import { User } from "../auth/entities/user.entity";
import { ROLE } from "src/constants";

@Injectable()
export class HodStatisticsService {
    constructor(
        @InjectRepository(Class)
        private classRepository: Repository<Class>,
        @InjectRepository(ExamSession)
        private examSessionRepository: Repository<ExamSession>,
        @InjectRepository(StudentExam)
        private studentExamRepository: Repository<StudentExam>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
    ) {}

    /**
     * Lấy thống kê tổng quan cho HOD Dashboard
     * Bao gồm: số lớp, số GV, số ca thi, số thí sinh
     */
    async getDashboardStats(hodId: string) {
        // Đếm lớp do HOD tạo
        const classesCount = await this.classRepository.count({
            where: { createdById: hodId },
        });

        // Đếm tổng giáo viên trong hệ thống
        const lecturersCount = await this.userRepository.count({
            where: { role: ROLE.LECTURER },
        });

        // Đếm ca thi
        const examSessionsCount = await this.examSessionRepository.count();

        // Đếm thí sinh đã làm bài
        const studentExamsCount = await this.studentExamRepository.count();

        return {
            classesCount,
            lecturersCount,
            examSessionsCount,
            studentExamsCount,
        };
    }

    /**
     * Lấy thống kê giáo viên và lớp phụ trách
     * Trả về danh sách giáo viên kèm số lớp đang dạy
     */
    async getLecturerClassStats(hodId: string) {
        // Lấy tất cả lớp của HOD kèm giáo viên
        const classes = await this.classRepository.find({
            where: { createdById: hodId },
            relations: ["lecturers"],
        });

        // Tạo map: lecturerId -> { lecturer info, classes }
        const lecturerMap = new Map<string, { lecturer: any; classNames: string[] }>();

        for (const cls of classes) {
            for (const lecturer of cls.lecturers) {
                if (!lecturerMap.has(lecturer.id)) {
                    lecturerMap.set(lecturer.id, {
                        lecturer: {
                            id: lecturer.id,
                            fullName: lecturer.fullName,
                            email: lecturer.email,
                            phone: lecturer.phone,
                        },
                        classNames: [],
                    });
                }
                lecturerMap.get(lecturer.id).classNames.push(cls.name);
            }
        }

        return Array.from(lecturerMap.values()).map((item) => ({
            ...item.lecturer,
            classCount: item.classNames.length,
            classNames: item.classNames,
        }));
    }

    /**
     * Lấy thống kê ca thi theo lớp
     * Trả về danh sách ca thi kèm điểm trung bình
     */
    async getExamSessionStats() {
        const sessions = await this.examSessionRepository.find({
            relations: ["matrix", "matrix.subject"],
            order: { createdAt: "DESC" },
        });

        const result = [];
        for (const session of sessions) {
            // Lấy điểm trung bình của ca thi
            const avgResult = await this.studentExamRepository.createQueryBuilder("se").select("AVG(se.score)", "avgScore").addSelect("COUNT(se.id)", "totalStudents").addSelect("COUNT(CASE WHEN se.status = :submitted THEN 1 END)", "submittedCount").where("se.sessionId = :sessionId", { sessionId: session.id }).setParameter("submitted", "SUBMITTED").getRawOne();

            result.push({
                id: session.id,
                name: session.name,
                subjectName: session.matrix?.subject?.name || "N/A",
                startTime: session.startTime,
                endTime: session.endTime,
                status: session.status,
                totalStudents: parseInt(avgResult?.totalStudents || "0"),
                submittedCount: parseInt(avgResult?.submittedCount || "0"),
                avgScore: avgResult?.avgScore ? parseFloat(parseFloat(avgResult.avgScore).toFixed(2)) : 0,
            });
        }

        return result;
    }

    /**
     * Lấy dữ liệu biểu đồ: điểm trung bình theo ca thi
     */
    async getScoreChartData() {
        const sessions = await this.examSessionRepository.find({
            order: { startTime: "ASC" },
            take: 20,
        });

        const chartData = [];
        for (const session of sessions) {
            const avgResult = await this.studentExamRepository.createQueryBuilder("se").select("AVG(se.score)", "avgScore").where("se.sessionId = :sessionId", { sessionId: session.id }).andWhere("se.status = :status", { status: "SUBMITTED" }).getRawOne();

            chartData.push({
                sessionName: session.name,
                avgScore: avgResult?.avgScore ? parseFloat(parseFloat(avgResult.avgScore).toFixed(2)) : 0,
            });
        }

        return chartData;
    }
}
