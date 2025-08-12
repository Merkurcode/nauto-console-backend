/**
 * Interface for raw Prisma audit log data
 * Used for converting database records to domain entities
 */
export interface IPrismaAuditLogData {
  id: string;
  level: string;
  type: string;
  action: string;
  message: string;
  userId: string | null;
  metadata: JsonValue;
  timestamp: Date;
  context: string;
  createdAt?: Date;
  updatedAt?: Date;
}

import { JsonValue } from '@prisma/client/runtime/library';

/**
 * Interface for audit log metadata structure
 * Provides type safety for JSON metadata fields
 */
export interface IAuditLogMetadata {
  statusCode?: number;
  method?: string;
  path?: string;
  userAgent?: string;
  ipAddress?: string;
  tokenId?: string;
  botAlias?: string;
  companyId?: string;
  sessionId?: string;
  duration?: number;
  requestId?: string;
  responseSize?: number;
  error?: string;
  stackTrace?: string;
  [key: string]: string | number | boolean | null | undefined;
}

/**
 * Interface for raw Prisma AI Assistant data
 */
export interface IPrismaAIAssistantData {
  id: string;
  name: string;
  area: string;
  available: boolean;
  description: JsonValue;
  features: IPrismaAIAssistantFeature[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Interface for Prisma AI Assistant feature data
 */
export interface IPrismaAIAssistantFeature {
  id: string;
  aiAssistantId?: string;
  keyName: string;
  title: JsonValue;
  description: JsonValue;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Interface for raw Prisma Company AI Assistant data
 */
export interface IPrismaCompanyAIAssistantData {
  id: string;
  companyId: string;
  aiAssistantId: string;
  enabled: boolean;
  features: IPrismaCompanyAIAssistantFeature[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Interface for Prisma Company AI Assistant feature data
 */
export interface IPrismaCompanyAIAssistantFeature {
  id: string;
  featureId: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}
