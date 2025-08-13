import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AIPersonaController } from './ai-persona.controller';
import { InfrastructureModule } from '@infrastructure/infrastructure.module';
import { CoreModule } from '@core/core.module';

// Command Handlers
import { CreateAIPersonaCommandHandler } from '@application/commands/ai-persona/create-ai-persona.command';
import { UpdateAIPersonaCommandHandler } from '@application/commands/ai-persona/update-ai-persona.command';
import { DeleteAIPersonaCommandHandler } from '@application/commands/ai-persona/delete-ai-persona.command';
import { AssignAIPersonaToCompanyCommandHandler } from '@application/commands/ai-persona/assign-ai-persona-to-company.command';
import { UpdateAIPersonaStatusCommandHandler } from '@application/commands/ai-persona/update-ai-persona-status.command';
import { UpdateCompanyAIPersonaStatusCommandHandler } from '@application/commands/ai-persona/update-company-ai-persona-status.command';

// Query Handlers
import { GetAIPersonaByIdQueryHandler } from '@application/queries/ai-persona/get-ai-persona-by-id.query';
import { GetAllAIPersonasQueryHandler } from '@application/queries/ai-persona/get-all-ai-personas.query';
import { GetCompanyAIPersonasQueryHandler } from '@application/queries/ai-persona/get-company-ai-personas.query';
import { GetCompanyActiveAIPersonaQueryHandler } from '@application/queries/ai-persona/get-company-active-ai-persona.query';

const CommandHandlers = [
  CreateAIPersonaCommandHandler,
  UpdateAIPersonaCommandHandler,
  DeleteAIPersonaCommandHandler,
  AssignAIPersonaToCompanyCommandHandler,
  UpdateAIPersonaStatusCommandHandler,
  UpdateCompanyAIPersonaStatusCommandHandler,
];

const QueryHandlers = [
  GetAIPersonaByIdQueryHandler,
  GetAllAIPersonasQueryHandler,
  GetCompanyAIPersonasQueryHandler,
  GetCompanyActiveAIPersonaQueryHandler,
];

@Module({
  imports: [CqrsModule, InfrastructureModule, CoreModule],
  controllers: [AIPersonaController],
  providers: [...CommandHandlers, ...QueryHandlers],
  exports: [],
})
export class AIPersonaModule {}
