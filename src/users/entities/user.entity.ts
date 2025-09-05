import { Session } from '@/auth/entities/session.entity';
import { Commentary } from '@/comments/entities/comment.entity';
import { Role } from '@/common/domain/role.enum';
import { Ticket } from '@/tickets/entities/ticket.entity';
import {
  Entity, PrimaryGeneratedColumn, Column, OneToMany, Unique, Index,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

@Entity('user')
@Unique(['email'])
@Unique(['azureId'])
@Index(['azureTenantId'])
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({ type: 'varchar', length: 255 })
  password!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  displayName!: string | null;

  @Column({ type: 'enum', enum: Role, default: Role.user })
  role!: Role;

  @Column({ type: 'varchar', length: 255, nullable: true })
  azureId!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  azureTenantId!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  avatarUrl!: string | null;

  @OneToMany(() => Session, (s) => s.user)
  sessions!: Session[];

  @OneToMany(() => Ticket, (t) => t.author)
  tickets!: Ticket[];

  @OneToMany(() => Ticket, (t) => t.assignee)
  assigned!: Ticket[];

  @OneToMany(() => Commentary, (c) => c.author)
  comments!: Commentary[];

  @CreateDateColumn({ type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt!: Date;
}
