// src/plans/plans.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  Patch,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { PlansService } from './plans.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { ToggleStatusDto } from './dto/toggle-status.dto';
import { JwtAuthGuard } from '../auth/auth.guard';

// Swagger (optional – comment out if you don't use it)
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('plans')
@ApiBearerAuth()
@Controller('plans')
@UseGuards(JwtAuthGuard)
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new plan' })
  async create(@Body() data: CreatePlanDto, @Req() req: any) {
    const userId = req.user?.id;
    if (!userId) throw new BadRequestException('User not authenticated');
    return this.plansService.create(data, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all plans for the authenticated user' })
  async findAll(@Req() req: any) {
    const userId = req.user?.id;
    if (!userId) throw new BadRequestException('User not authenticated');
    return this.plansService.findAll(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single plan by ID' })
  async findOne(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.id;
    if (!userId) throw new BadRequestException('User not authenticated');
    return this.plansService.findOne(+id, userId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a plan' })
  async update(
    @Param('id') id: string,
    @Body() data: UpdatePlanDto,
    @Req() req: any,
  ) {
    const userId = req.user?.id;
    if (!userId) throw new BadRequestException('User not authenticated');
    return this.plansService.update(+id, data, userId);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Toggle plan active/inactive status' })
  async toggleStatus(
    @Param('id') id: string,
    @Body() { isActive }: ToggleStatusDto,
    @Req() req: any,
  ) {
    const userId = req.user?.id;
    if (!userId) throw new BadRequestException('User not authenticated');
    return this.plansService.toggleStatus(+id, isActive, userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a plan' })
  async remove(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.id;
    if (!userId) throw new BadRequestException('User not authenticated');
    return this.plansService.remove(+id, userId);
  }
}
