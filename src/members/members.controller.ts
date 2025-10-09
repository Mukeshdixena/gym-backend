import {
  Get,
  Param,
  Delete,
  Put,
  Body,
  Controller,
  Post,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  UsePipes,
  ValidationPipe,
  Logger,
} from '@nestjs/common';
import { MembersService } from './members.service';
import { Prisma } from '@prisma/client';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';

@Controller('members')
export class MembersController {
  private readonly logger = new Logger(MembersController.name);

  constructor(private readonly membersService: MembersService) {}

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async create(@Body() data: CreateMemberDto) {
    try {
      const member = await this.membersService.create(data);
      this.logger.log(`✅ Member created: ${member.email}`);
      return {
        success: true,
        message: 'Member created successfully',
        data: member,
      };
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  @Get()
  async findAll() {
    const members = await this.membersService.findAll();
    return { success: true, count: members.length, data: members };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      const member = await this.membersService.findOne(Number(id));
      return { success: true, data: member };
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  @Put(':id')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async update(@Param('id') id: string, @Body() data: UpdateMemberDto) {
    try {
      const updated = await this.membersService.update(Number(id), data);
      this.logger.log(`📝 Member updated: ID ${id}`);
      return {
        success: true,
        message: 'Member updated successfully',
        data: updated,
      };
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    try {
      await this.membersService.remove(Number(id));
      this.logger.warn(`🗑️ Member deleted: ID ${id}`);
      return { success: true, message: 'Member deleted successfully' };
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  private handlePrismaError(error: any): never {
    this.logger.error(error.message);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new BadRequestException('Email already exists.');
      }
      if (error.code === 'P2025') {
        throw new NotFoundException('Record not found.');
      }
    }

    throw new InternalServerErrorException(
      'Something went wrong. Please try again later.',
    );
  }
}
