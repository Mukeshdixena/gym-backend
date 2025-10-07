import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { EnrollmentsService } from './enrollments.service';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';

@Controller('enrollments')
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Post()
  async createEnrollment(@Body() dto: CreateEnrollmentDto) {
    return this.enrollmentsService.createEnrollment(dto);
  }

  @Get('pending-bills')
  async getPendingBills() {
    return this.enrollmentsService.getPendingBills();
  }

  @Get('approved-bills')
  async getApprovedBills() {
    return this.enrollmentsService.getApprovedBills();
  }

  @Patch('approve/:membershipId')
  async approveBill(@Param('membershipId') membershipId: number) {
    return this.enrollmentsService.approveBill(membershipId);
  }

  @Delete('reject/:membershipId')
  async rejectBill(@Param('membershipId') membershipId: number) {
    return this.enrollmentsService.rejectBill(membershipId);
  }
}
