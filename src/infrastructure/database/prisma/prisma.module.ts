import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './prisma.service';
import { TransactionService } from './transaction.service';
import { TransactionContextService } from './transaction-context.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [PrismaService, TransactionService, TransactionContextService],
  exports: [PrismaService, TransactionService, TransactionContextService],
})
export class PrismaModule {}
