// src/memberships/dto/update-membership.dto.ts
import { IsOptional, IsDateString, IsInt, IsEnum } from 'class-validator';
import { MembershipStatus } from '@prisma/client';

export class UpdateMembershipDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsInt()
  planId?: number;

  @IsOptional()
  @IsEnum(MembershipStatus)
  status?: MembershipStatus;

  @IsOptional()
  paid?: number;

  @IsOptional()
  discount?: number;

  @IsOptional()
  pending?: number;
}
