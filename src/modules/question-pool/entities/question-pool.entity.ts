import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from "typeorm";
import { Subject } from "../../subject/entities/subject.entity";
import { Question } from "../../question/entities/question.entity";
import { User } from "../../auth/entities/user.entity";

@Entity("question_pools")
export class QuestionPool {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ type: "varchar", length: 255 })
    name: string;

    @Column({ type: "text", nullable: true })
    description: string;

    @ManyToOne(() => Subject, (subject) => subject.questionPools, {
        onDelete: "CASCADE",
    })
    @JoinColumn({ name: "subject_id" })
    subject: Subject;

    @Column({ name: "subject_id" })
    subjectId: string;

    /** Bộ câu hỏi dùng chung (HOD tạo) hay riêng (GV tạo) */
    @Column({ name: "is_public", type: "boolean", default: false })
    isPublic: boolean;

    /** Người tạo bộ câu hỏi */
    @ManyToOne(() => User, { onDelete: "SET NULL", nullable: true })
    @JoinColumn({ name: "created_by_id" })
    createdBy: User;

    @Column({ name: "created_by_id", nullable: true })
    createdById: string;

    @OneToMany(() => Question, (question) => question.pool)
    questions: Question[];

    @CreateDateColumn({ name: "created_at" })
    createdAt: Date;

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt: Date;
}
