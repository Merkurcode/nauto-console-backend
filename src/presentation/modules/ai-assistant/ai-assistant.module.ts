import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { CoreModule } from '@core/core.module';
import { InfrastructureModule } from '@infrastructure/infrastructure.module';
import { AIAssistantController } from './ai-assistant.controller';
import { AIAssistantMapper } from '@application/mappers/ai-assistant.mapper';
import { GetAvailableAssistantsQueryHandler } from '@application/queries/ai-assistant/get-available-assistants.query';
import { GetCompanyAssistantsQueryHandler } from '@application/queries/ai-assistant/get-company-assistants.query';
import { AssignAssistantToCompanyCommandHandler } from '@application/commands/ai-assistant/assign-assistant-to-company.command';
import { ToggleAssistantStatusCommandHandler } from '@application/commands/ai-assistant/toggle-assistant-status.command';
import { ToggleFeatureStatusCommandHandler } from '@application/commands/ai-assistant/toggle-feature-status.command';
// Repository tokens are provided by InfrastructureModule

const commandHandlers = [
  AssignAssistantToCompanyCommandHandler,
  ToggleAssistantStatusCommandHandler,
  ToggleFeatureStatusCommandHandler,
];

const queryHandlers = [GetAvailableAssistantsQueryHandler, GetCompanyAssistantsQueryHandler];

@Module({
  imports: [CqrsModule, CoreModule, InfrastructureModule],
  controllers: [AIAssistantController],
  providers: [
    // Mappers
    AIAssistantMapper,

    // Command and Query handlers
    ...commandHandlers,
    ...queryHandlers,
  ],
})
export class AIAssistantModule {}
