import { IsString, IsEmail, IsOptional, Length } from 'class-validator';

export class CreateMemberDto {
  @IsString()
  @Length(2, 50)
  firstName!: string;

  @IsString()
  @Length(2, 50)
  lastName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @Length(10, 15)
  phone!: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  referralSource?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
