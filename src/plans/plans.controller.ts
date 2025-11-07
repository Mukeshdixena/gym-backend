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
  Query,
} from '@nestjs/common';
import { PlansService } from './plans.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { ToggleStatusDto } from './dto/toggle-status.dto';
import { JwtAuthGuard } from '../auth/auth.guard';
import { PaginatedDto } from '../common/dto/paginated.dto';
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

  // ──────── PAGINATED GET ALL ────────
  @Get()
  async findAll(
    @Req() req: any,
    @Query('id') id?: string,
    @Query('name') name?: string,
    @Query('price') price?: string,
    @Query('duration') duration?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const userId = req.user?.id;
    if (!userId) throw new BadRequestException('User not authenticated');

    return this.plansService.findAllPaginated(userId, {
      id,
      name,
      price,
      duration,
      status,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 10,
    });
  }
  @Get('list-all')
  @ApiOperation({
    summary: 'Get all plans for the authenticated user (with filters)',
  })
  async findAllLIst(
    @Req() req: any,
    @Query('isActive') isActive?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('order') order?: 'asc' | 'desc',
  ) {
    const userId = req.user?.id;
    if (!userId) throw new BadRequestException('User not authenticated');

    return this.plansService.findAll(userId, {
      isActive,
      minPrice,
      maxPrice,
      search,
      sortBy,
      order,
    });
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
