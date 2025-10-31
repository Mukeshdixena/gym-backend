// src/plans/dto/toggle-status.dto.ts
import { IsBoolean } from 'class-validator';

export class ToggleStatusDto {
  @IsBoolean()
  isActive!: boolean; // definite assignment
}
