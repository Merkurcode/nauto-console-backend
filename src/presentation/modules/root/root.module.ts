import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

// Controllers
import { RootController } from './root.controller';

// Import other modules
import { UserModule } from '../user/user.module';
import { RoleModule } from '../role/role.module';
import { CoreModule } from '@core/core.module';

@Module({
  imports: [CqrsModule, UserModule, RoleModule, CoreModule],
  controllers: [RootController],
})
export class RootModule {}
