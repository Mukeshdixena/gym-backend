import { Test, TestingModule } from '@nestjs/testing';
import { MemberAddonsController } from './member-addons.controller';

describe('MemberAddonsController', () => {
  let controller: MemberAddonsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MemberAddonsController],
    }).compile();

    controller = module.get<MemberAddonsController>(MemberAddonsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
