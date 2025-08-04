import { Global, Module } from '@nestjs/common';
import { LoggerService } from './logger.service';
import { LOGGER_SERVICE } from '@shared/constants/tokens';

@Global()
@Module({
  providers: [
    LoggerService,
    {
      provide: LOGGER_SERVICE,
      useClass: LoggerService,
    },
  ],
  exports: [LoggerService, LOGGER_SERVICE],
})
export class LoggerModule {}
