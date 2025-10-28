import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { PlansService } from './plans.service';
import { Prisma } from '@prisma/client';
// import { AuthGuard } from '../auth/auth.guard'; // adjust import path if needed
import { AuthGuard } from '@nestjs/passport';

@Controller('plans')
@UseGuards(AuthGuard)
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Post()
  async create(@Body() data: Prisma.PlanCreateInput, @Req() req: any) {
    const userId = req.user?.id;
    if (!userId) throw new BadRequestException('User not authenticated');
    return this.plansService.create(data, userId);
  }

  @Get()
  async findAll(@Req() req: any) {
    const userId = req.user?.id;
    if (!userId) throw new BadRequestException('User not authenticated');
    return this.plansService.findAll(userId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.id;
    if (!userId) throw new BadRequestException('User not authenticated');
    return this.plansService.findOne(Number(id), userId);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() data: Prisma.PlanUpdateInput,
    @Req() req: any,
  ) {
    const userId = req.user?.id;
    if (!userId) throw new BadRequestException('User not authenticated');
    return this.plansService.update(Number(id), data, userId);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.id;
    if (!userId) throw new BadRequestException('User not authenticated');
    return this.plansService.remove(Number(id), userId);
  }
}
