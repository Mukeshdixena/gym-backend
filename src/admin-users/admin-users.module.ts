import { Module, forwardRef } from '@nestjs/common';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthModule } from '../auth/auth.module'; // ✅ Import AuthService from AuthModule

@Module({
  imports: [forwardRef(() => AuthModule)], // ✅ Use AuthService directly
  controllers: [AdminUsersController],
  providers: [AdminUsersService, PrismaService],
})
export class AdminUsersModule {}
