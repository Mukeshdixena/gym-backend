import { Test, TestingModule } from '@nestjs/testing';
import { MemberAddonsService } from './member-addons.service';

describe('MemberAddonsService', () => {
  let service: MemberAddonsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MemberAddonsService],
    }).compile();

    service = module.get<MemberAddonsService>(MemberAddonsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
