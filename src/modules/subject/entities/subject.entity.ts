import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    OneToMany,
} from 'typeorm';
import { QuestionPool } from '../../question-pool/entities/question-pool.entity';

@Entity('subjects')
export class Subject {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 255 })
    name: string;

    @Column({ type: 'varchar', length: 50, unique: true, nullable: true })
    code: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @OneToMany(() => QuestionPool, (pool) => pool.subject)
    questionPools: QuestionPool[];

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
