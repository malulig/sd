import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Commentary } from './entities/comment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Commentary])],
  exports: [TypeOrmModule],
})
export class CommentsModule {}
