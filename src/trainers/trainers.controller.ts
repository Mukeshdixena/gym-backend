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
} from '@nestjs/common';
import { TrainersService } from './trainers.service';
import { Prisma } from '@prisma/client';
import { JwtAuthGuard } from '../auth/auth.guard'; // ← Reusable guard
import { Request } from 'express';

// Define authenticated request
interface AuthRequest extends Request {
  user: {
    id: number;
  };
}

@UseGuards(JwtAuthGuard) // ← Clean, reusable, typed
@Controller('trainers')
export class TrainersController {
  constructor(private readonly trainersService: TrainersService) {}

  @Post()
  create(@Body() data: Prisma.TrainerCreateInput, @Req() req: AuthRequest) {
    const userId = req.user.id;
    if (!userId) throw new ForbiddenException('User not authenticated');
    return this.trainersService.create(data, userId);
  }

  @Get()
  findAll(@Req() req: AuthRequest) {
    const userId = req.user.id;
    if (!userId) throw new ForbiddenException('User not authenticated');
    return this.trainersService.findAll(userId);
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
    @Body() data: Prisma.TrainerUpdateInput,
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
