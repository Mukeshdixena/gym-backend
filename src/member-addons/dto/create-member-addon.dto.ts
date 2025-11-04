// src/member-addons/dto/create-member-addon.dto.ts
import {
  IsInt,
  IsDateString,
  IsNumber,
  Min,
  IsEnum,
  IsOptional,
} from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class CreateMemberAddonDto {
  @IsInt()
  memberId!: number;

  @IsInt()
  addonId!: number;

  @IsOptional()
  @IsInt()
  trainerId?: number;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsNumber()
  @Min(0)
  paid!: number;

  @IsNumber()
  @Min(0)
  discount!: number;

  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;
}
