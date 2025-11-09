// src/members/members.controller.ts
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
  Query,
} from '@nestjs/common';
import { MembersService } from './members.service';
import { Prisma } from '@prisma/client';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { JwtAuthGuard } from '../auth/auth.guard';
import { Request } from 'express';
// import { PaginatedDto } from '../common/dto/paginated.dto';

interface AuthRequest extends Request {
  user: { id: number };
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
      throw this.handleError(error);
    }
  }

  // PAGINATED LIST
  @Get()
  async findAll(
    @Req() req: AuthRequest,
    @Query()
    query: {
      page?: number;
      limit?: number;
      id?: string;
      name?: string;
      gender?: string; // <-- Replace email with gender
      phone?: string;
      plan?: string;
      status?: string;
      sortBy?: string;
      sortOrder?: 'ASC' | 'DESC';
    },
  ) {
    const result = await this.membersService.findAllPaginated(
      req.user.id,
      query,
    );
    return { success: true, ...result };
  }

  @Get('recent')
  async getRecent(@Req() req: AuthRequest) {
    const recent = await this.membersService.getRecentMembers(req.user.id);
    return { success: true, data: recent };
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: AuthRequest) {
    try {
      const member = await this.membersService.findOne(Number(id), req.user.id);
      return { success: true, data: member };
    } catch (error) {
      throw this.handleError(error);
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
      throw this.handleError(error);
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: AuthRequest) {
    try {
      await this.membersService.remove(Number(id), req.user.id);
      return { success: true, message: 'Member deleted successfully' };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private handleError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // Unique constraint violation
      if (error.code === 'P2002') {
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

      // Record not found
      if (error.code === 'P2025') {
        throw new NotFoundException('Member not found.');
      }

      // Foreign key constraint violation
      if (error.code === 'P2003') {
        throw new BadRequestException(
          'Cannot delete member because it is associated with one or more memberships.',
        );
      }
    }

    // Log truly unexpected errors
    console.error('Unexpected error in MembersController:', error);
    throw new InternalServerErrorException(
      'An unexpected error occurred. Please try again later.',
    );
  }
}
