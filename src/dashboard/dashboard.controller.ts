// src/dashboard/dashboard.controller.ts
import {
  Controller,
  Get,
  Query,
  BadRequestException,
  UseGuards,
  Req,
  InternalServerErrorException,
} from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/auth.guard';

interface AuthRequest extends Request {
  user: {
    id: number;
  };
}

@UseGuards(JwtAuthGuard)
@Controller('api/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  async getSummary(@Req() req: AuthRequest) {
    try {
      return await this.dashboardService.getSummary(req.user.id);
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to load dashboard summary',
      );
    }
  }

  @Get('alerts')
  async getAlerts(@Req() req: AuthRequest) {
    try {
      return await this.dashboardService.getAlerts(req.user.id);
    } catch (error) {
      throw new InternalServerErrorException('Failed to load alerts');
    }
  }

  @Get('revenue-trend')
  async getRevenueTrend(@Query('days') days: string, @Req() req: AuthRequest) {
    const parsedDays = days ? parseInt(days, 10) : 30;
    if (isNaN(parsedDays) || parsedDays < 1 || parsedDays > 365)
      throw new BadRequestException('days must be between 1 and 365');
    try {
      return await this.dashboardService.getRevenueTrend(
        req.user.id,
        parsedDays,
      );
    } catch (error) {
      throw new InternalServerErrorException('Failed to load revenue trend');
    }
  }

  @Get('membership-status')
  async getMembershipStatus(@Req() req: AuthRequest) {
    try {
      return await this.dashboardService.getMembershipStatus(req.user.id);
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to load membership status',
      );
    }
  }

  @Get('member-growth')
  async getMemberGrowth(
    @Query('months') months: string,
    @Req() req: AuthRequest,
  ) {
    const parsedMonths = months ? parseInt(months, 10) : 6;
    if (isNaN(parsedMonths) || parsedMonths < 1 || parsedMonths > 24)
      throw new BadRequestException('months must be between 1 and 24');
    try {
      return await this.dashboardService.getMemberGrowth(
        req.user.id,
        parsedMonths,
      );
    } catch (error) {
      throw new InternalServerErrorException('Failed to load member growth');
    }
  }

  @Get('recent-activity')
  async getRecentActivity(
    @Query('limit') limit: string,
    @Req() req: AuthRequest,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 10;
    if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 50)
      throw new BadRequestException('limit must be between 1 and 50');
    try {
      return await this.dashboardService.getRecentActivity(
        req.user.id,
        parsedLimit,
      );
    } catch (error) {
      throw new InternalServerErrorException('Failed to load recent activity');
    }
  }

  @Get('top-plans')
  async getTopPlans(@Query('limit') limit: string, @Req() req: AuthRequest) {
    const parsedLimit = limit ? parseInt(limit, 10) : 5;
    if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 20)
      throw new BadRequestException('limit must be between 1 and 20');
    try {
      return await this.dashboardService.getTopPlans(req.user.id, parsedLimit);
    } catch (error) {
      throw new InternalServerErrorException('Failed to load top plans');
    }
  }

  @Get('expenses-summary')
  async getExpensesSummary(@Req() req: AuthRequest) {
    try {
      return await this.dashboardService.getExpensesSummary(req.user.id);
    } catch (error) {
      throw new InternalServerErrorException('Failed to load expenses summary');
    }
  }

  @Get('trainer-workload')
  async getTrainerWorkload(@Req() req: AuthRequest) {
    try {
      return await this.dashboardService.getTrainerWorkload(req.user.id);
    } catch (error) {
      throw new InternalServerErrorException('Failed to load trainer workload');
    }
  }

  @Get('upcoming-renewals')
  async getUpcomingRenewals(
    @Query('days') days: string,
    @Req() req: AuthRequest,
  ) {
    const parsedDays = days ? parseInt(days, 10) : 7;
    if (isNaN(parsedDays) || parsedDays < 1 || parsedDays > 30)
      throw new BadRequestException('days must be between 1 and 30');
    try {
      return await this.dashboardService.getUpcomingRenewals(
        req.user.id,
        parsedDays,
      );
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to load upcoming renewals',
      );
    }
  }
}
