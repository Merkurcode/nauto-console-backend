import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { CoreModule } from '@core/core.module';
import { InfrastructureModule } from '@infrastructure/infrastructure.module';
import { AuthEmailUserCreatedHandler } from './event-handlers/auth-email-user-registered.handler';

const EventHandlers = [AuthEmailUserCreatedHandler];

@Module({
  imports: [
    CqrsModule,
    CoreModule, // Para EmailService y SmsService
    InfrastructureModule, // Para otros servicios y configuración
  ],
  providers: [...EventHandlers],
  exports: [...EventHandlers],
})
export class AuthEmailModuleQueue {}
