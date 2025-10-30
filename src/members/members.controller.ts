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
  UseGuards,
  Req,
} from '@nestjs/common';
import { MembersService } from './members.service';
import { Prisma } from '@prisma/client';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { JwtAuthGuard } from '../auth/auth.guard';
import { Request } from 'express';

// Define authenticated request type
interface AuthRequest extends Request {
  user: {
    id: number;
  };
}

@UseGuards(JwtAuthGuard)
@Controller('members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async create(@Body() data: CreateMemberDto, @Req() req: AuthRequest) {
    try {
      const member = await this.membersService.create(data, req.user.id);
      return {
        success: true,
        message: 'Member created successfully',
        data: member,
      };
    } catch (error) {
      throw this.handlePrismaError(error);
    }
  }

  @Get()
  async findAll(@Req() req: AuthRequest) {
    const members = await this.membersService.findAll(req.user.id);
    return { success: true, count: members.length, data: members };
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: AuthRequest) {
    try {
      const member = await this.membersService.findOne(Number(id), req.user.id);
      return { success: true, data: member };
    } catch (error) {
      throw this.handlePrismaError(error);
    }
  }

  @Put(':id')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async update(
    @Param('id') id: string,
    @Body() data: UpdateMemberDto,
    @Req() req: AuthRequest,
  ) {
    try {
      const updated = await this.membersService.update(
        Number(id),
        req.user.id,
        data,
      );
      return {
        success: true,
        message: 'Member updated successfully',
        data: updated,
      };
    } catch (error) {
      throw this.handlePrismaError(error);
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: AuthRequest) {
    try {
      await this.membersService.remove(Number(id), req.user.id);
      return { success: true, message: 'Member deleted successfully' };
    } catch (error) {
      throw this.handlePrismaError(error);
    }
  }

  @Get('recent')
  async getRecent(@Req() req: AuthRequest) {
    const recent = await this.membersService.getRecentMembers(req.user.id);
    return { success: true, data: recent };
  }

  // ──────────────────────────────────────────────────────────────────────
  // Centralized Prisma error handler with field-specific messages
  // ──────────────────────────────────────────────────────────────────────
  private handlePrismaError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        // Unique constraint violation
        const target = (error.meta as { target?: string[] })?.target || [];
        if (Array.isArray(target)) {
          if (target.includes('email')) {
            throw new BadRequestException(
              'A member with this email already exists.',
            );
          }
          if (target.includes('phone')) {
            throw new BadRequestException(
              'A member with this phone number already exists.',
            );
          }
        }
        throw new BadRequestException('This value is already taken.');
      }

      if (error.code === 'P2025') {
        throw new NotFoundException('Member not found.');
      }
    }

    // Log error in production (optional)
    console.error('Unexpected error in MembersController:', error);

    throw new InternalServerErrorException(
      'An unexpected error occurred. Please try again later.',
    );
  }
}
