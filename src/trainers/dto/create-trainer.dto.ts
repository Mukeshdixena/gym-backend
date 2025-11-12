// src/trainers/dto/create-trainer.dto.ts
import {
  IsString,
  IsEmail,
  IsOptional,
  IsNumber,
  IsDateString,
} from 'class-validator';

export class CreateTrainerDto {
  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  phone!: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsNumber()
  salary?: number;

  @IsOptional()
  @IsString()
  speciality?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsDateString()
  joiningDate?: string;
}
