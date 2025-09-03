import { Ticket } from '@/tickets/entities/ticket.entity';
import { User } from '@/users/entities/user.entity';
import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, Index, CreateDateColumn, JoinColumn,
} from 'typeorm';

@Entity('comment')
@Index(['ticketId'])
@Index(['authorId'])
export class Commentary {
  @PrimaryGeneratedColumn() id!: number;

  @Column() ticketId!: number;
  @Column() authorId!: number;

  @Column({ type: 'text' }) body!: string;

  @ManyToOne(() => Ticket, (t) => t.comments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ticketId' })
  ticket!: Ticket;

  @ManyToOne(() => User, (u) => u.comments)
  @JoinColumn({ name: 'authorId' })
  author!: User;

  @CreateDateColumn() createdAt!: Date;
}
