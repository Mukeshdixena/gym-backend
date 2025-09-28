import { Module } from '@nestjs/common';
import { TrainersService } from './trainers.service';
import { TrainersController } from './trainers.controller';

@Module({
  providers: [TrainersService],
  controllers: [TrainersController]
})
export class TrainersModule {}
