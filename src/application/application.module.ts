import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

const EventHandlers = [];

@Module({
  imports: [CqrsModule],
  providers: [...EventHandlers],
  exports: [...EventHandlers],
})
export class ApplicationModule {}
