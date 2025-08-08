import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { CoreModule } from '@core/core.module';
import { InfrastructureModule } from '@infrastructure/infrastructure.module';
import { BotManagementController } from './bot-management.controller';
import { BotAuditController } from './bot-audit.controller';

/**
 * BOT Module
 *
 * Handles BOT user management and token operations for external integrations.
 * This module provides secure endpoints for:
 * - BOT user creation and management
 * - BOT token generation, listing, and revocation
 * - BOT operation auditing and logging
 *
 * Security Features:
 * - ROOT-only access for sensitive operations
 * - ADMIN access for company-scoped BOT user creation
 * - Comprehensive audit logging for all BOT activities
 * - Multi-layer authorization with Guards
 *
 * Architecture:
 * - Controllers: Handle HTTP requests and validation
 * - Commands/Queries: Business logic through CQRS pattern
 * - Guards: Multi-layer security enforcement
 * - Interceptors: Automatic audit logging for BOT operations
 */
@Module({
  imports: [CqrsModule, CoreModule, InfrastructureModule],
  controllers: [BotManagementController, BotAuditController],
  providers: [],
  exports: [],
})
export class BotModule {}
