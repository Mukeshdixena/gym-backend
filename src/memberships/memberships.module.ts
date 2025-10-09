import { Module } from '@nestjs/common';
import { MembershipsController } from './memberships.controller';
import { MembershipsService } from './memberships.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [MembershipsController],
  providers: [MembershipsService, PrismaService],
})
export class MembershipsModule {}
