import {
  Controller,
  Get,
  UseGuards,
  Req,
  InternalServerErrorException,
} from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { Request } from 'express';

interface AuthRequest extends Request {
  user: { id: number };
}

@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  async getDashboard(@Req() req: AuthRequest) {
    try {
      const data = await this.dashboardService.getDashboardData(req.user.id);
      return {
        success: true,
        message: 'Dashboard data fetched successfully',
        data,
      };
    } catch (error) {
      console.error('Dashboard Error:', error);
      throw new InternalServerErrorException(
        'Failed to load dashboard data. Please try again later.',
      );
    }
  }
}
