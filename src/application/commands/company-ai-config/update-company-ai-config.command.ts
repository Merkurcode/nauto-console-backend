import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { UpdateCompanyAIConfigDto } from '@application/dtos/company-ai-config/update-company-ai-config.dto';
import { CompanyService } from '@core/services/company.service';
import { ICompanyAIConfigResponse } from '@application/dtos/_responses/company-ai-config/company-ai-config.response.interface';
import { IJwtPayload } from '@application/dtos/_responses/user/user.response';
import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE } from '@shared/constants/tokens';

/**
 * Command for updating company AI configuration
 * Following Clean Architecture: Application layer commands for write operations
 * PUT operation: replaces entire JSON with received data
 */
export class UpdateCompanyAIConfigCommand implements ICommand {
  constructor(
    public readonly companyId: string,
    public readonly configData: UpdateCompanyAIConfigDto,
    public readonly currentUser: IJwtPayload,
  ) {}
}

/**
 * Command handler for updating company AI configuration
 * Following Clean Architecture: Commands ALWAYS use domain services for business logic
 */
@CommandHandler(UpdateCompanyAIConfigCommand)
export class UpdateCompanyAIConfigHandler
  implements ICommandHandler<UpdateCompanyAIConfigCommand, ICompanyAIConfigResponse>
{
  constructor(
    private readonly companyService: CompanyService,
    @Inject(LOGGER_SERVICE)
    private readonly logger: ILogger,
  ) {}

  async execute(command: UpdateCompanyAIConfigCommand): Promise<ICompanyAIConfigResponse> {
    const { companyId, configData, currentUser } = command;

    const company = await this.companyService.updateAIConfiguration(
      currentUser,
      companyId,
      configData,
    );

    this.logger.log({
      message: 'Company AI configuration updated successfully',
      action: 'UPDATE_AI_CONFIG_SUCCESS',
      userId: currentUser.sub,
      userEmail: currentUser.email,
      companyId: company.id.getValue(),
      hasConfiguration: company.configAI !== null,
      lastUpdated: company.lastUpdated?.toISOString(),
      timestamp: new Date().toISOString(),
    });

    return {
      companyId: company.id.getValue(),
      hasConfiguration: company.configAI !== null,
      lastUpdated: company.lastUpdated?.toISOString(),
      welcomeMessage: company.configAI?.welcomeMessage,
      temperature: company.configAI?.temperature,
      responseInstructions: company.configAI?.responseInstructions,
      clientDiscoveryInstructions: company.configAI?.clientDiscoveryInstructions,
    };
  }
}
