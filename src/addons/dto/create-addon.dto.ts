import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAddonDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @Type(() => Number)
  @IsNumber({ allowNaN: false }, { message: 'Price must be a valid number' })
  price!: number;

  @Type(() => Number)
  @IsNumber(
    { allowNaN: false },
    { message: 'Duration days must be a valid number' },
  )
  durationDays!: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}
