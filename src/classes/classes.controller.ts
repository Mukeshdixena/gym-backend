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
import { ClassesService } from './classes.service';
import { Prisma } from '@prisma/client';
import { JwtAuthGuard } from '../auth/auth.guard'; // ← Import your guard
import { Request } from 'express';

interface AuthRequest extends Request {
  user?: { id: number }; // ← Define your user shape
}

@UseGuards(JwtAuthGuard) // ← Clean & reusable
@Controller('classes')
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @Post()
  create(@Body() data: Prisma.ClassCreateInput, @Req() req: AuthRequest) {
    const userId = req.user?.id;
    if (!userId) throw new ForbiddenException('User not authenticated');
    return this.classesService.create(data, userId);
  }

  @Get()
  findAll(@Req() req: AuthRequest) {
    const userId = req.user?.id;
    if (!userId) throw new ForbiddenException('User not authenticated');
    return this.classesService.findAll(userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: AuthRequest) {
    const userId = req.user?.id;
    if (!userId) throw new ForbiddenException('User not authenticated');
    return this.classesService.findOne(Number(id), userId);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() data: Prisma.ClassUpdateInput,
    @Req() req: AuthRequest,
  ) {
    const userId = req.user?.id;
    if (!userId) throw new ForbiddenException('User not authenticated');
    return this.classesService.update(Number(id), data, userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: AuthRequest) {
    const userId = req.user?.id;
    if (!userId) throw new ForbiddenException('User not authenticated');
    return this.classesService.remove(Number(id), userId);
  }
}
