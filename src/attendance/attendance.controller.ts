import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { Prisma } from '@prisma/client';

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post()
  create(@Body() data: Prisma.AttendanceCreateInput) {
    return this.attendanceService.create(data);
  }

  @Get()
  findAll() {
    return this.attendanceService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.attendanceService.findOne(Number(id));
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() data: Prisma.AttendanceUpdateInput) {
    return this.attendanceService.update(Number(id), data);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.attendanceService.remove(Number(id));
  }
}
