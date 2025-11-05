import {
  IsOptional,
  IsString,
  IsNumber,
  IsDateString,
  Min,
  IsIn,
} from 'class-validator';

export class CreateEnrollmentDto {
  // ─────────────── Member Selection ───────────────
  @IsOptional()
  @IsNumber()
  selectedMember?: number;

  // ─────────────── New Member Info (if created) ───────────────
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  @IsIn(['Male', 'Female', 'Other'], {
    message: 'Gender must be Male, Female, or Other',
  })
  gender?: string;

  @IsOptional()
  @IsString()
  referralSource?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  // ─────────────── Membership Details ───────────────
  @IsNumber()
  planId!: number;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  paid?: number;

  // ─────────────── Payment Info ───────────────
  @IsOptional()
  @IsString()
  @IsIn(['CASH', 'CARD', 'UPI', 'ONLINE'], {
    message: 'Payment method must be CASH, CARD, UPI, or ONLINE',
  })
  paymentMethod?: string;
}
