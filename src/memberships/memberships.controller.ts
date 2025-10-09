import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  BadRequestException,
  InternalServerErrorException,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { MembershipsService } from './memberships.service';
import { CreateMembershipDto } from './dto/create-membership.dto';

@Controller('memberships')
export class MembershipsController {
  constructor(private readonly membershipsService: MembershipsService) {}

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async create(@Body() dto: CreateMembershipDto) {
    try {
      return await this.membershipsService.create(dto);
    } catch (error) {
      console.error('❌ Membership create controller error:', error);
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException(
        'Unable to assign membership plan',
      );
    }
  }

  @Get()
  async findAll() {
    return this.membershipsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const parsedId = Number(id);
    if (isNaN(parsedId)) throw new BadRequestException('Invalid ID');
    return this.membershipsService.findOne(parsedId);
  }
}
