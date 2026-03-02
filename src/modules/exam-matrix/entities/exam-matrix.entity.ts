import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from "typeorm";
import { Subject } from "../../subject/entities/subject.entity";
import { ExamSession } from "../../exam-session/entities/exam-session.entity";
import { MatrixSettings } from "../interfaces/matrix-settings.interface";

@Entity("exam_matrices")
export class ExamMatrix {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ type: "varchar", length: 255 })
    name: string;

    @Column({ type: "text", nullable: true })
    description: string;

    @Column({ type: "int", default: 90 })
    duration: number;

    @ManyToOne(() => Subject, { nullable: true })
    @JoinColumn({ name: "subject_id" })
    subject: Subject;

    @Column({ name: "subject_id", nullable: true })
    subjectId: string;

    @Column({ type: "jsonb" })
    settings: MatrixSettings;

    @Column({ type: "int", default: 0, name: "total_mcq_count" })
    totalMcqCount: number;

    @Column({ type: "int", default: 0, name: "total_group_count" })
    totalGroupCount: number;

    @Column({ type: "int", default: 0, name: "total_short_answer_count" })
    totalShortAnswerCount: number;

    @OneToMany(() => ExamSession, (session) => session.matrix)
    sessions: ExamSession[];

    @CreateDateColumn({ name: "created_at" })
    createdAt: Date;

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt: Date;
}
