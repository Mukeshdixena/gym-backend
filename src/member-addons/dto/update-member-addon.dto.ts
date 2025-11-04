// src/member-addons/dto/update-member-addon.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateMemberAddonDto } from './create-member-addon.dto';

export class UpdateMemberAddonDto extends PartialType(CreateMemberAddonDto) {}
