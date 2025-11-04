import { IsNumber, IsOptional, IsString } from 'class-validator';
export class RefundAddonDto {
  @IsNumber() amount!: number;
  @IsOptional() @IsString() reason?: string;
  @IsOptional() @IsString() method?: string;
}
