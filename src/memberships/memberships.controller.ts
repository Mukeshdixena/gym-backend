import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  Patch,
  BadRequestException,
  InternalServerErrorException,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { MembershipsService } from './memberships.service';
import { CreateMembershipDto } from './dto/create-membership.dto';
import { UpdateMembershipDto } from './dto/update-membership.dto';
import { MembershipStatus, PaymentMethod } from '@prisma/client';

@Controller('memberships')
export class MembershipsController {
  constructor(private readonly membershipsService: MembershipsService) {}

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async create(@Body() dto: CreateMembershipDto) {
    try {
      return await this.membershipsService.create(dto);
    } catch (error) {
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

  @Patch(':id')
  async updateMembership(
    @Param('id') id: string,
    @Body() dto: UpdateMembershipDto,
  ) {
    const parsedId = Number(id);
    if (isNaN(parsedId)) throw new BadRequestException('Invalid ID');

    try {
      return await this.membershipsService.updateMembership(parsedId, dto);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException('Failed to update membership');
    }
  }

  @Patch('payment/:id')
  async addPayment(
    @Param('id') id: string,
    @Body()
    body: {
      amount?: number; // optional now
      discount?: number;
      method?: string; // optional now
      status?: string; // optional
    },
  ) {
    const parsedId = Number(id);
    if (isNaN(parsedId)) throw new BadRequestException('Invalid ID');

    return this.membershipsService.addPayment(parsedId, {
      amount: body.amount,
      discount: body.discount,
      method: body.method as keyof typeof PaymentMethod,
      status: body.status as keyof typeof MembershipStatus,
    });
  }
}
