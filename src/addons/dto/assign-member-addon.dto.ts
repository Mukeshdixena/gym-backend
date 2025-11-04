import { IsNumber, IsDateString, IsOptional } from 'class-validator';

export class AssignMemberAddonDto {
  @IsNumber() memberId!: number;
  @IsNumber() addonId!: number;
  @IsOptional() @IsNumber() trainerId?: number;
  @IsDateString() startDate!: string;
  @IsDateString() endDate!: string;
  @IsOptional() @IsNumber() price?: number;
}
