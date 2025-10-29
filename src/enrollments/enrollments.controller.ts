import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard'; // ← Reusable guard
import { EnrollmentsService } from './enrollments.service';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';

// Define user shape from JWT
interface AuthRequest extends Request {
  user: {
    id: number;
    // add email, role, etc. if needed
  };
}

@Controller('enrollments')
@UseGuards(JwtAuthGuard) // ← Clean, reusable, typed
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Post()
  async createEnrollment(
    @Body() dto: CreateEnrollmentDto,
    @Req() req: AuthRequest,
  ) {
    return this.enrollmentsService.createEnrollment(dto, req.user.id);
  }

  @Get('pending-bills')
  async getPendingBills(@Req() req: AuthRequest) {
    return this.enrollmentsService.getPendingBills(req.user.id);
  }

  @Get('approved-bills')
  async getApprovedBills(@Req() req: AuthRequest) {
    return this.enrollmentsService.getApprovedBills(req.user.id);
  }

  @Patch('approve/:membershipId')
  async approveBill(
    @Param('membershipId') membershipId: string,
    @Req() req: AuthRequest,
  ) {
    return this.enrollmentsService.approveBill(
      Number(membershipId),
      req.user.id,
    );
  }

  @Delete('reject/:membershipId')
  async rejectBill(
    @Param('membershipId') membershipId: string,
    @Req() req: AuthRequest,
  ) {
    return this.enrollmentsService.rejectBill(
      Number(membershipId),
      req.user.id,
    );
  }
}
