import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { TransactionService } from './transaction.service';
import { TransactionContextService } from './transaction-context.service';

@Global()
@Module({
  providers: [PrismaService, TransactionService, TransactionContextService],
  exports: [PrismaService, TransactionService, TransactionContextService],
})
export class PrismaModule {}
