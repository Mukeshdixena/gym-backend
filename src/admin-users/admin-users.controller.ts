import { Controller, Get, Patch, Param, UseGuards } from '@nestjs/common';
import { AdminUsersService } from './admin-users.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { AdminGuard } from '../auth/admin.guard';

@Controller('admin-users')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get('pending')
  listPending() {
    return this.adminUsersService.listPending();
  }

  @Patch('approve/:id')
  approve(@Param('id') id: string) {
    return this.adminUsersService.approve(+id);
  }

  @Patch('reject/:id')
  reject(@Param('id') id: string) {
    return this.adminUsersService.reject(+id);
  }
}
