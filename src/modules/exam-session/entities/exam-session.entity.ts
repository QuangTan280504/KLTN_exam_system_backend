import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from "typeorm";
import { ExamMatrix } from "../../exam-matrix/entities/exam-matrix.entity";
import { StudentExam } from "../../student-exam/entities/student-exam.entity";
import { User } from "../../auth/entities/user.entity";
import { SessionStatus } from "../enums/session-status.enum";

@Entity("exam_sessions")
export class ExamSession {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ type: "varchar", length: 255 })
    name: string;

    @ManyToOne(() => ExamMatrix, (matrix) => matrix.sessions, {
        onDelete: "RESTRICT",
    })
    @JoinColumn({ name: "matrix_id" })
    matrix: ExamMatrix;

    @Column({ name: "matrix_id" })
    matrixId: string;

    @Column({ type: "timestamp", name: "start_time" })
    startTime: Date;

    @Column({ type: "timestamp", name: "end_time" })
    endTime: Date;

    @Column({ type: "int", name: "duration_minutes" })
    durationMinutes: number;

    @Column({
        type: "varchar",
        length: 20,
        default: SessionStatus.DRAFT,
    })
    status: SessionStatus;

    /** Lớp thi — khớp với student.className để auto-assign khi publish */
    @Column({ type: "varchar", length: 100, nullable: true, name: "class_name" })
    className: string;

    /** Cho học sinh xem điểm sau khi nộp bài hay không */
    @Column({ type: "boolean", default: false, name: "show_score" })
    showScore: boolean;

    /** Người tạo ca thi (giảng viên phụ trách) */
    @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
    @JoinColumn({ name: "created_by_id" })
    createdBy: User;

    @Column({ name: "created_by_id", nullable: true })
    createdById: string;

    @OneToMany(() => StudentExam, (studentExam) => studentExam.session)
    studentExams: StudentExam[];

    @CreateDateColumn({ name: "created_at" })
    createdAt: Date;

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt: Date;
}
