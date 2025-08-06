import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PrismaModule } from '@infrastructure/database/prisma/prisma.module';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';
import { CoreModule } from '@core/core.module';
import { AIAssistantController } from './ai-assistant.controller';
import { AIAssistantRepository } from '@infrastructure/repositories/ai-assistant.repository';
import { CompanyAIAssistantRepository } from '@infrastructure/repositories/company-ai-assistant.repository';
import { AIAssistantMapper } from '@application/mappers/ai-assistant.mapper';
import { GetAvailableAssistantsQueryHandler } from '@application/queries/ai-assistant/get-available-assistants.query';
import { GetCompanyAssistantsQueryHandler } from '@application/queries/ai-assistant/get-company-assistants.query';
import { AssignAssistantToCompanyCommandHandler } from '@application/commands/ai-assistant/assign-assistant-to-company.command';
import { ToggleAssistantStatusCommandHandler } from '@application/commands/ai-assistant/toggle-assistant-status.command';
import { ToggleFeatureStatusCommandHandler } from '@application/commands/ai-assistant/toggle-feature-status.command';
import { REPOSITORY_TOKENS } from '@shared/constants/tokens';

const commandHandlers = [
  AssignAssistantToCompanyCommandHandler,
  ToggleAssistantStatusCommandHandler,
  ToggleFeatureStatusCommandHandler,
];

const queryHandlers = [GetAvailableAssistantsQueryHandler, GetCompanyAssistantsQueryHandler];

@Module({
  imports: [CqrsModule, PrismaModule, CoreModule],
  controllers: [AIAssistantController],
  providers: [
    {
      provide: REPOSITORY_TOKENS.AI_ASSISTANT_REPOSITORY,
      useFactory: (prisma: PrismaService) => new AIAssistantRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: REPOSITORY_TOKENS.COMPANY_AI_ASSISTANT_REPOSITORY,
      useFactory: (prisma: PrismaService) => new CompanyAIAssistantRepository(prisma),
      inject: [PrismaService],
    },
    AIAssistantMapper,
    ...commandHandlers,
    ...queryHandlers,
  ],
  exports: [
    REPOSITORY_TOKENS.AI_ASSISTANT_REPOSITORY,
    REPOSITORY_TOKENS.COMPANY_AI_ASSISTANT_REPOSITORY,
  ],
})
export class AIAssistantModule {}
