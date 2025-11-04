import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsOptional,
  IsBoolean,
} from 'class-validator';

export class CreateAddonDto {
  @IsString() name!: string;
  @IsOptional() @IsString() description?: string;
  @IsNumber() price!: number;
  @IsNumber() durationDays!: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
