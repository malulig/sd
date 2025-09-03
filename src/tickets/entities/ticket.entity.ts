import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, Index,
  CreateDateColumn, UpdateDateColumn, JoinColumn,
} from 'typeorm';
import { TicketStatus } from 'src/common/domain/ticket-status.enum';
import { User } from '@/users/entities/user.entity';
import { Commentary } from '@/comments/entities/comment.entity';

@Entity('ticket')
@Index(['status'])
@Index(['authorId'])
@Index(['assigneeId'])
export class Ticket {
  @PrimaryGeneratedColumn() id!: number;

  @Column({ length: 500 }) title!: string;
  @Column({ type: 'text', nullable: true }) body!: string | null;
  @Column({ type: 'enum', enum: TicketStatus, default: TicketStatus.OPEN })
  status!: TicketStatus;

  @Column() authorId!: number;
  @ManyToOne(() => User, (u) => u.tickets)
  @JoinColumn({ name: 'authorId' })
  author!: User;

  @Column({ type: 'int', nullable: true }) assigneeId!: number | null;
  @ManyToOne(() => User, (u) => u.assigned, { nullable: true })
  @JoinColumn({ name: 'assigneeId' })
  assignee!: User | null;

  @OneToMany(() => Commentary, (c) => c.ticket) comments!: Comment[];

  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
}
