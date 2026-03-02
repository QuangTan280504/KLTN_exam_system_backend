import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToMany } from "typeorm";
import { Class } from "../../class/entities/class.entity";

@Entity("users")
export class User {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ unique: true })
    username: string;

    @Column()
    password: string; // bcrypt hashed

    @Column()
    fullName: string;

    @Column({ nullable: true, unique: true })
    email: string;

    @Column({ nullable: true, unique: true })
    phone: string;

    @Column({ default: "ADMIN" })
    role: string; // ADMIN | LECTURER

    @Column({ default: false })
    isFirstLogin: boolean;

    /** Danh sách lớp mà giáo viên phụ trách (inverse side) */
    @ManyToMany(() => Class, (cls) => cls.lecturers)
    classes: Class[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
