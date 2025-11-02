import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
  BadRequestException, // ✅ added
} from '@nestjs/common';
import { AdminUsersService } from './admin-users.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { Request } from 'express';
@Controller('admin-users')
@UseGuards(JwtAuthGuard, AdminGuard) // ✅ protect all routes for admins only
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  // ✅ Get all users (admin-only)
  @Get()
  getAllUsers() {
    return this.adminUsersService.getAllUsers();
  }

  // ✅ Get single user
  @Get(':id')
  getUserById(@Param('id') id: string) {
    return this.adminUsersService.getUserById(+id);
  }

  // ✅ Create new user (admin can manually add)
  @Post()
  createUser(
    @Body()
    data: {
      name: string;
      email: string;
      password: string;
      role: string;
      status?: string;
    },
  ) {
    return this.adminUsersService.createUser(data);
  }

  // ✅ Update user
  @Patch(':id')
  updateUser(
    @Param('id') id: string,
    @Body()
    data: {
      name?: string;
      email?: string;
      role?: string;
      status?: string;
      password?: string;
    },
  ) {
    return this.adminUsersService.updateUser(+id, data);
  }

  // ✅ Delete user
  @Delete(':id')
  deleteUser(@Param('id') id: string) {
    return this.adminUsersService.deleteUser(+id);
  }

  // ✅ Get only pending users
  @Get('pending/all')
  getPendingUsers() {
    return this.adminUsersService.findPendingUsers();
  }

  // ✅ Approve user
  @Patch('approve/:id')
  approveUser(@Param('id') id: string) {
    return this.adminUsersService.approveUser(+id);
  }

  // ✅ Reject user
  @Patch('reject/:id')
  rejectUser(@Param('id') id: string) {
    return this.adminUsersService.rejectUser(+id);
  }

  @Post('impersonate/:id')
  async impersonateUser(@Req() req: Request, @Param('id') id: string) {
    const userPayload = req.user as any;
    const adminId = userPayload.userId || userPayload.id || userPayload.sub;

    if (!adminId) {
      throw new BadRequestException('Invalid admin token: no user ID found');
    }

    return this.adminUsersService.impersonateUser(adminId, +id);
  }
}
