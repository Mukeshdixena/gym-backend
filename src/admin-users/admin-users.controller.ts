import { Controller, Get, Put, Param, UseGuards } from '@nestjs/common';
import { AdminUsersService } from './admin-users.service';
import { JwtAuthGuard } from '../auth/auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get('pending')
  async getPending() {
    return this.adminUsersService.listPending();
  }

  @Put(':id/approve')
  async approve(@Param('id') id: string) {
    return this.adminUsersService.approve(Number(id));
  }

  @Put(':id/reject')
  async reject(@Param('id') id: string) {
    return this.adminUsersService.reject(Number(id));
  }
}
