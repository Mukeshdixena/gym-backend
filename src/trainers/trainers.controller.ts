import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
} from '@nestjs/common';
import { TrainersService } from './trainers.service';
import { Prisma } from '@prisma/client';

@Controller('trainers')
export class TrainersController {
  constructor(private readonly trainersService: TrainersService) {}

  @Post()
  create(@Body() data: Prisma.TrainerCreateInput) {
    return this.trainersService.create(data);
  }

  @Get()
  findAll() {
    return this.trainersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.trainersService.findOne(Number(id));
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() data: Prisma.TrainerUpdateInput) {
    return this.trainersService.update(Number(id), data);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.trainersService.remove(Number(id));
  }
}
