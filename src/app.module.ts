import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config'; // <-- NEW
import { PrismaModule } from './prisma/prisma.module';
import { MembersModule } from './members/members.module';
import { PlansModule } from './plans/plans.module';
import { TrainersModule } from './trainers/trainers.module';
import { ClassesModule } from './classes/classes.module';
import { MembershipsModule } from './memberships/memberships.module';
import { AttendanceModule } from './attendance/attendance.module';
import { EnrollmentsModule } from './enrollments/enrollments.module';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PaymentsModule } from './payments/payments.module';

@Module({
  imports: [
    // ---------------------------------------------------------------
    // 1. ConfigModule – MUST be first (loads .env and makes ConfigService global)
    // ---------------------------------------------------------------
    ConfigModule.forRoot({
      isGlobal: true, // <-- makes ConfigService injectable in main.ts, controllers, services, etc.
      envFilePath: '.env', // optional – remove if you don’t use .env
      expandVariables: true, // allows ${VAR} syntax in .env
    }),

    // ---------------------------------------------------------------
    // 2. Your existing feature modules
    // ---------------------------------------------------------------
    PrismaModule,
    MembersModule,
    PlansModule,
    TrainersModule,
    ClassesModule,
    MembershipsModule,
    AttendanceModule,
    EnrollmentsModule,
    UserModule,
    AuthModule,
    DashboardModule,
    PaymentsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
