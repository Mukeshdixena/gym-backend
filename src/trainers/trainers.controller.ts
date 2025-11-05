// src/trainers/trainers.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  Req,
  UseGuards,
  ForbiddenException,
  Query,
} from '@nestjs/common';
import { TrainersService } from './trainers.service';
import { Prisma } from '@prisma/client';
import { JwtAuthGuard } from '../auth/auth.guard';
import { Request } from 'express';
import { PaginatedDto } from '../common/dto/paginated.dto';
import { CreateTrainerDto } from './dto/create-trainer.dto';
import { UpdateTrainerDto } from './dto/update-trainer.dto';

interface AuthRequest extends Request {
  user: { id: number };
}

@UseGuards(JwtAuthGuard)
@Controller('trainers')
export class TrainersController {
  constructor(private readonly trainersService: TrainersService) {}

  @Post()
  create(@Body() data: CreateTrainerDto, @Req() req: AuthRequest) {
    const userId = req.user.id;
    if (!userId) throw new ForbiddenException('User not authenticated');
    return this.trainersService.create(data, userId);
  }

  // PAGINATED GET ALL
  @Get()
  findAll(@Req() req: AuthRequest, @Query() query: PaginatedDto) {
    const userId = req.user.id;
    if (!userId) throw new ForbiddenException('User not authenticated');
    return this.trainersService.findAllPaginated(userId, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: AuthRequest) {
    const userId = req.user.id;
    if (!userId) throw new ForbiddenException('User not authenticated');
    return this.trainersService.findOne(Number(id), userId);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() data: UpdateTrainerDto,
    @Req() req: AuthRequest,
  ) {
    const userId = req.user.id;
    if (!userId) throw new ForbiddenException('User not authenticated');
    return this.trainersService.update(Number(id), data, userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: AuthRequest) {
    const userId = req.user.id;
    if (!userId) throw new ForbiddenException('User not authenticated');
    return this.trainersService.remove(Number(id), userId);
  }
}
