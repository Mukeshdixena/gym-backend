import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  Patch,
  Delete,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
  BadRequestException,
  Query,
} from '@nestjs/common';
import { AddonsService } from './addons.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CreateAddonDto } from './dto/create-addon.dto';
import { UpdateAddonDto } from './dto/update-addon.dto';
import { AssignMemberAddonDto } from './dto/assign-member-addon.dto';
import { RefundAddonDto } from './dto/refund-addon.dto';
import { PaginatedDto } from '../common/dto/paginated.dto';

interface AuthRequest extends Request {
  user: { id: number };
}

@UseGuards(JwtAuthGuard)
@Controller('addons')
export class AddonsController {
  constructor(private readonly addonsService: AddonsService) {}

  // ────────────── CREATE ──────────────
  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async create(@Body() dto: CreateAddonDto, @Req() req: AuthRequest) {
    const addon = await this.addonsService.create(dto, req.user.id);
    return {
      success: true,
      message: 'Addon created successfully',
      data: addon,
    };
  }

  // ────────────── PAGINATED FETCH ──────────────
  @Get()
  async findAll(@Req() req: AuthRequest, @Query() query: PaginatedDto) {
    const result = await this.addonsService.findAllPaginated(
      req.user.id,
      query,
    );
    return {
      success: true,
      message: 'Addons fetched successfully',
      data: result.data,
      meta: result.meta,
    };
  }

  // ────────────── FILTERED LIST ──────────────
  @Get('list-all')
  async findAllAddons(
    @Req() req: AuthRequest,
    @Query('isActive') isActive?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('order') order?: 'asc' | 'desc',
  ) {
    const userId = req.user?.id;
    if (!userId) throw new BadRequestException('User not authenticated');

    return this.addonsService.findAll(userId, {
      isActive,
      minPrice,
      maxPrice,
      search,
      sortBy,
      order,
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: AuthRequest) {
    const parsedId = Number(id);
    if (isNaN(parsedId)) throw new BadRequestException('Invalid Addon ID');

    const data = await this.addonsService.findOne(parsedId, req.user.id);
    return { success: true, message: 'Addon fetched successfully', data };
  }

  // ────────────── UPDATE ──────────────
  @Patch(':id')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAddonDto,
    @Req() req: AuthRequest,
  ) {
    const parsedId = Number(id);
    if (isNaN(parsedId)) throw new BadRequestException('Invalid Addon ID');

    const data = await this.addonsService.update(parsedId, dto, req.user.id);
    return { success: true, message: 'Addon updated successfully', data };
  }

  // ────────────── DELETE ──────────────
  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: AuthRequest) {
    const parsedId = Number(id);
    if (isNaN(parsedId)) throw new BadRequestException('Invalid Addon ID');

    const result = await this.addonsService.delete(parsedId, req.user.id);
    return {
      success: true,
      message: 'Addon deleted successfully',
      data: result,
    };
  }

  // ────────────── ASSIGN ADDON ──────────────
  @Post('assign')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async assignMemberAddon(
    @Body() dto: AssignMemberAddonDto,
    @Req() req: AuthRequest,
  ) {
    const data = await this.addonsService.assignMemberAddon(dto, req.user.id);
    return { success: true, message: 'Addon assigned successfully', data };
  }

  // ────────────── REFUND ADDON ──────────────
  @Patch('refund/:id')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async refundAddon(
    @Param('id') id: string,
    @Body() dto: RefundAddonDto,
    @Req() req: AuthRequest,
  ) {
    const parsedId = Number(id);
    if (isNaN(parsedId)) throw new BadRequestException('Invalid Addon ID');

    const data = await this.addonsService.refundAddon(
      parsedId,
      dto,
      req.user.id,
    );
    return {
      success: true,
      message: 'Addon refund processed successfully',
      data,
    };
  }
}
