import { Module } from '@nestjs/common';
import { AdminUsersService } from './admin-users.service';
import { AdminUsersController } from './admin-users.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [AdminUsersController],
  providers: [AdminUsersService, PrismaService],
})
export class AdminUsersModule {}
