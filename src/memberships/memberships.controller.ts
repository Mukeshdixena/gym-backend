import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
} from '@nestjs/common';
import { MembershipsService } from './memberships.service';
import { Prisma } from '@prisma/client';

@Controller('memberships')
export class MembershipsController {
  constructor(private readonly membershipsService: MembershipsService) {}

  @Post()
  create(@Body() data: Prisma.MembershipCreateInput) {
    return this.membershipsService.create(data);
  }

  @Get()
  findAll() {
    return this.membershipsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.membershipsService.findOne(Number(id));
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() data: Prisma.MembershipUpdateInput) {
    return this.membershipsService.update(Number(id), data);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.membershipsService.remove(Number(id));
  }
}
