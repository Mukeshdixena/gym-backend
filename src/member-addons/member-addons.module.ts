// src/member-addons/member-addons.module.ts
import { Module } from '@nestjs/common';
import { MemberAddonsController } from './member-addons.controller';
import { MemberAddonsService } from './member-addons.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [MemberAddonsController],
  providers: [MemberAddonsService, PrismaService],
})
export class MemberAddonsModule {}
