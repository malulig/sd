import { User } from '@/users/entities/user.entity';
import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, Index, CreateDateColumn, UpdateDateColumn, JoinColumn,
} from 'typeorm';

@Entity('session')
@Index(['userId'])
@Index(['expiresAt'])
export class Session {
  @PrimaryGeneratedColumn('uuid') id!: string;

  @Column() userId!: number;

  @ManyToOne(() => User, (u) => u.sessions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ length: 255 }) refreshHash!: string;
  @Column({ length: 500, nullable: true }) userAgent!: string | null;
  @Column({ length: 100, nullable: true }) ip!: string | null;

  @Column({ type: 'datetime' }) expiresAt!: Date;
  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
  @Column({ type: 'datetime', nullable: true }) revokedAt!: Date | null;
}
