import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerService } from '@infrastructure/services/throttler.service';
import { THROTTLER_SERVICE } from '@shared/constants/tokens';

@Module({
  imports: [ConfigModule],
  providers: [
    ThrottlerService,
    {
      provide: THROTTLER_SERVICE,
      useClass: ThrottlerService,
    },
  ],
  exports: [ThrottlerService, THROTTLER_SERVICE],
})
export class ThrottlerModule {}
