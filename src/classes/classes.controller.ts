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
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';

@UseGuards(AuthGuard('jwt'))
@Controller('classes')
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @Post()
  create(
    @Body() data: Prisma.ClassCreateInput,
    @Req() req: Request & { user?: any },
  ) {
    const userId = req.user?.id;
    if (!userId) throw new ForbiddenException('User not authenticated');
    return this.classesService.create(data, userId);
  }

  @Get()
  findAll(@Req() req: Request & { user?: any }) {
    const userId = req.user?.id;
    if (!userId) throw new ForbiddenException('User not authenticated');
    return this.classesService.findAll(userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: Request & { user?: any }) {
    const userId = req.user?.id;
    if (!userId) throw new ForbiddenException('User not authenticated');
    return this.classesService.findOne(Number(id), userId);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() data: Prisma.ClassUpdateInput,
    @Req() req: Request & { user?: any },
  ) {
    const userId = req.user?.id;
    if (!userId) throw new ForbiddenException('User not authenticated');
    return this.classesService.update(Number(id), data, userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: Request & { user?: any }) {
    const userId = req.user?.id;
    if (!userId) throw new ForbiddenException('User not authenticated');
    return this.classesService.remove(Number(id), userId);
  }
}
