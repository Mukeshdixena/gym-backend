import { IsOptional, IsNumber, IsString } from 'class-validator';

export class UpdateMembershipDto {
  @IsOptional()
  @IsNumber()
  paid?: number;

  @IsOptional()
  @IsNumber()
  discount?: number;

  @IsOptional()
  @IsString()
  status?: string;
}
