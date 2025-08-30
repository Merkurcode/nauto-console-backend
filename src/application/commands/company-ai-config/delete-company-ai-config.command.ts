import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { CompanyService } from '@core/services/company.service';
import { IJwtPayload } from '@application/dtos/_responses/user/user.response';
import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE } from '@shared/constants/tokens';

/**
 * Command for deleting company AI configuration
 * Following Clean Architecture: Application layer commands for write operations
 */
export class DeleteCompanyAIConfigCommand implements ICommand {
  constructor(
    public readonly companyId: string,
    public readonly currentUser: IJwtPayload,
  ) {}
}

/**
 * Command handler for deleting company AI configuration
 * Following Clean Architecture: Commands ALWAYS use domain services for business logic
 */
@CommandHandler(DeleteCompanyAIConfigCommand)
export class DeleteCompanyAIConfigHandler
  implements ICommandHandler<DeleteCompanyAIConfigCommand, boolean>
{
  constructor(
    private readonly companyService: CompanyService,
    @Inject(LOGGER_SERVICE)
    private readonly logger: ILogger,
  ) {}

  async execute(command: DeleteCompanyAIConfigCommand): Promise<boolean> {
    const { companyId, currentUser } = command;

    await this.companyService.deleteAIConfiguration(currentUser, companyId);

    this.logger.log({
      message: 'Company AI configuration deleted successfully',
      action: 'DELETE_AI_CONFIG_SUCCESS',
      userId: currentUser.sub,
      userEmail: currentUser.email,
      companyId: companyId,
      timestamp: new Date().toISOString(),
    });

    return true;
  }
}
