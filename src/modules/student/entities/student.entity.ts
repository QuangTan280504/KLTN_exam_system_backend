import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, JoinColumn } from "typeorm";
import { StudentExam } from "../../student-exam/entities/student-exam.entity";

@Entity("students")
export class Student {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ type: "varchar", length: 50, unique: true, name: "student_code" })
    studentCode: string;

    @Column({ type: "varchar", length: 255, name: "full_name" })
    fullName: string;

    /** Tên đăng nhập (do GV tạo, mặc định = studentCode) */
    @Column({ type: "varchar", length: 100, unique: true, nullable: true })
    username: string;

    /** Mật khẩu đã hash (bcrypt) */
    @Column({ type: "varchar", length: 255, nullable: true })
    password: string;

    /** Bắt buộc đổi mật khẩu lần đầu đăng nhập */
    @Column({ type: "boolean", default: true, name: "must_change_password" })
    mustChangePassword: boolean;

    @Column({ type: "date", nullable: true, name: "date_of_birth" })
    dateOfBirth: Date;

    @Column({ type: "varchar", length: 100, nullable: true, name: "class_name" })
    className: string;

    @OneToMany(() => StudentExam, (exam) => exam.student)
    exams: StudentExam[];

    @CreateDateColumn({ name: "created_at" })
    createdAt: Date;

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt: Date;
}
