import {
  IsNumber,
  IsDateString,
  IsOptional,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AssignMemberAddonDto {
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  memberId!: number;

  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  addonId!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  trainerId?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  price?: number;
}
