import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { MembersModule } from './members/members.module';
import { PlansModule } from './plans/plans.module';
import { TrainersModule } from './trainers/trainers.module';
import { ClassesModule } from './classes/classes.module';
import { MembershipsModule } from './memberships/memberships.module';
import { AttendanceModule } from './attendance/attendance.module';

@Module({
  imports: [PrismaModule, MembersModule, PlansModule, TrainersModule, ClassesModule, MembershipsModule, AttendanceModule],
})
export class AppModule {}
