import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { QuestionPool } from "../../question-pool/entities/question-pool.entity";
import { QuestionType, CognitiveLevel, MCQData, GroupData, ShortAnswerData } from "../interfaces/question-data.interface";

@Entity("questions")
export class Question {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @ManyToOne(() => QuestionPool, (pool) => pool.questions, {
        onDelete: "CASCADE",
        nullable: true,
    })
    @JoinColumn({ name: "pool_id" })
    pool: QuestionPool;

    @Column({ name: "pool_id", nullable: true })
    poolId: string;

    @Column({
        type: "varchar",
        length: 20,
        name: "question_type",
    })
    questionType: QuestionType;

    @Column({ type: "text" })
    content: string;

    @Column({
        type: "int",
        name: "cognitive_level",
        nullable: true,
    })
    cognitiveLevel: CognitiveLevel;

    @Column({ type: "jsonb" })
    data: MCQData | GroupData | ShortAnswerData;

    @Column({ type: "jsonb", nullable: true, default: [] })
    images: string[];

    @CreateDateColumn({ name: "created_at" })
    createdAt: Date;

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt: Date;
}
