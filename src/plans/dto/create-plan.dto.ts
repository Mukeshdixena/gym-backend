// src/plans/dto/create-plan.dto.ts
import { IsString, IsNumber, IsOptional, IsBoolean } from 'class-validator';

export class CreatePlanDto {
  @IsString()
  name!: string; // definite assignment

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  price!: number; // definite assignment

  @IsNumber()
  durationDays!: number; // definite assignment

  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true; // default value (optional)
}
