import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { IConcurrencyService } from '@core/repositories/concurrency.service.interface';
import { CONCURRENCY_SERVICE } from '@shared/constants/tokens';

export class ClearUserConcurrencySlotsCommand {
  constructor(public readonly userId: string) {}
}

@CommandHandler(ClearUserConcurrencySlotsCommand)
export class ClearUserConcurrencySlotsHandler
  implements ICommandHandler<ClearUserConcurrencySlotsCommand>
{
  constructor(
    @Inject(CONCURRENCY_SERVICE)
    private readonly concurrencyService: IConcurrencyService,
  ) {}

  async execute(command: ClearUserConcurrencySlotsCommand): Promise<void> {
    await this.concurrencyService.clearUserSlots(command.userId);
  }
}
