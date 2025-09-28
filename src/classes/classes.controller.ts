import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
} from '@nestjs/common';
import { ClassesService } from './classes.service';
import { Prisma } from '@prisma/client';

@Controller('classes')
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @Post()
  create(@Body() data: Prisma.ClassCreateInput) {
    return this.classesService.create(data);
  }

  @Get()
  findAll() {
    return this.classesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.classesService.findOne(Number(id));
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() data: Prisma.ClassUpdateInput) {
    return this.classesService.update(Number(id), data);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.classesService.remove(Number(id));
  }
}
