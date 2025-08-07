import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

// Controllers
import { RootController } from './root.controller';

// Query Handlers
import { GetAuditLogsQueryHandler } from '@application/queries/audit-log/get-audit-logs.query';

// Import other modules
import { UserModule } from '../user/user.module';
import { RoleModule } from '../role/role.module';
import { CoreModule } from '@core/core.module';
import { InfrastructureModule } from '@infrastructure/infrastructure.module';

@Module({
  imports: [CqrsModule, UserModule, RoleModule, CoreModule, InfrastructureModule],
  controllers: [RootController],
  providers: [
    // Query handlers
    GetAuditLogsQueryHandler,
  ],
})
export class RootModule {}
