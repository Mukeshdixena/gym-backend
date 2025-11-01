import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  UseGuards,
  Req,
} from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { Request } from 'express';

// Define authenticated request
interface AuthRequest extends Request {
  user: {
    id: number;
    email: string;
    name: string;
  };
}

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  getProfile(@Req() req: any) {
    return this.userService.findOne(req.user.id);
  }

  @Put('me')
  updateProfile(@Req() req: any, @Body() data: any) {
    return this.userService.update(req.user.id, data);
  }

  @Delete('me')
  deleteProfile(@Req() req: any) {
    return this.userService.remove(req.user.id);
  }
}
