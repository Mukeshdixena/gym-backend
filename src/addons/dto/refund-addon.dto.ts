import {
  IsNumber,
  IsOptional,
  IsString,
  IsNotEmpty,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RefundAddonDto {
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  @Min(0.01, { message: 'Refund amount must be greater than 0' })
  amount!: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  method?: string;
}
