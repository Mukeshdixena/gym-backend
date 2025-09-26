import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { MembersService } from './members.service';
import { Member } from '@prisma/client';

@Controller('members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Post()
  create(@Body() data: any): Promise<Member> {
    return this.membersService.create(data);
  }

  @Get()
  findAll(): Promise<Member[]> {
    return this.membersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Member | null> {
    return this.membersService.findOne(Number(id));
  }
}
