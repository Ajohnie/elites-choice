import { Test, TestingModule } from '@nestjs/testing';
import { LedgersService } from './ledgers.service';

describe('LedgersService', () => {
  let service: LedgersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LedgersService],
    }).compile();

    service = module.get<LedgersService>(LedgersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
