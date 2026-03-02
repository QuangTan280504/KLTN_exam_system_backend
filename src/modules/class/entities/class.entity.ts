/**
 * Entity Class (Lớp học)
 * Đại diện cho một lớp học trong hệ thống
 * Được tạo bởi Tổ trưởng bộ môn (HOD)
 */
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, ManyToMany, JoinColumn, JoinTable } from "typeorm";
import { User } from "../../auth/entities/user.entity";

@Entity("classes")
export class Class {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    /** Tên lớp học (VD: 10A1, 11B2) */
    @Column({ type: "varchar", length: 255 })
    name: string;

    /** Khối lớp (VD: 10, 11, 12) */
    @Column({ type: "varchar", length: 50, nullable: true })
    grade: string;

    /** Mô tả lớp học */
    @Column({ type: "text", nullable: true })
    description: string;

    /** Người tạo (Tổ trưởng bộ môn) */
    @ManyToOne(() => User, { onDelete: "SET NULL", nullable: true })
    @JoinColumn({ name: "created_by_id" })
    createdBy: User;

    @Column({ name: "created_by_id", nullable: true })
    createdById: string;

    /** Danh sách giáo viên phụ trách lớp (nhiều-nhiều) */
    @ManyToMany(() => User, (user) => user.classes)
    @JoinTable({
        name: "lecturer_classes",
        joinColumn: { name: "class_id", referencedColumnName: "id" },
        inverseJoinColumn: { name: "lecturer_id", referencedColumnName: "id" },
    })
    lecturers: User[];

    @CreateDateColumn({ name: "created_at" })
    createdAt: Date;

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt: Date;
}
