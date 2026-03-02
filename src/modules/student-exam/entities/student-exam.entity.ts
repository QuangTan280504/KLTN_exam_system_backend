import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from "typeorm";
import { ExamSession } from "../../exam-session/entities/exam-session.entity";
import { Student } from "../../student/entities/student.entity";
import { StudentExamStatus } from "../enums/student-exam-status.enum";

@Entity("student_exams")
@Index(["sessionId", "studentId"], { unique: true })
export class StudentExam {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @ManyToOne(() => ExamSession, (session) => session.studentExams, {
        onDelete: "CASCADE",
    })
    @JoinColumn({ name: "session_id" })
    session: ExamSession;

    @Column({ name: "session_id" })
    sessionId: string;

    @ManyToOne(() => Student, (student) => student.exams, {
        onDelete: "CASCADE",
    })
    @JoinColumn({ name: "student_id" })
    student: Student;

    @Column({ name: "student_id" })
    studentId: string;

    // [CƠ CHẾ CŨ] accessCode — không còn bắt buộc, giữ lại cho backward-compat
    @Column({ type: "varchar", length: 20, nullable: true, unique: false, name: "access_code" })
    accessCode: string;

    @Column({ type: "jsonb", nullable: true, name: "exam_snapshot" })
    examSnapshot: any; // ExamSnapshot structure

    @Column({ type: "jsonb", nullable: true, name: "student_answers" })
    studentAnswers: any; // StudentAnswers structure

    @Column({ type: "decimal", precision: 5, scale: 2, nullable: true })
    score: number;

    @Column({ type: "int", default: 0, name: "mcq_correct_count" })
    mcqCorrectCount: number;

    @Column({ type: "int", default: 0, name: "group_correct_count" })
    groupCorrectCount: number;

    @Column({ type: "timestamp", nullable: true, name: "started_at" })
    startedAt: Date;

    @Column({ type: "timestamp", nullable: true, name: "submitted_at" })
    submittedAt: Date;

    @Column({
        type: "varchar",
        length: 20,
        default: StudentExamStatus.REGISTERED,
    })
    @Index()
    status: StudentExamStatus;

    @CreateDateColumn({ name: "created_at" })
    createdAt: Date;

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt: Date;
}
