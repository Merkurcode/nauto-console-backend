import { Injectable, Scope } from '@nestjs/common';

/**
 * Request-scoped cache service
 * Provides caching for database operations within a single HTTP request
 * Automatically cleaned up at the end of each request
 */
@Injectable({ scope: Scope.REQUEST })
export class RequestCacheService {
  private readonly cache = new Map<string, unknown>();
  private readonly cacheMetadata = new Map<
    string,
    { timestamp: number; entityType: string; operation: string }
  >();

  // Operations that should have limited caching (only prevent duplicates within same request)
  private readonly SENSITIVE_OPERATIONS = new Set([
    'findBySessionToken',
    'validateSession',
    'findUserAuth',
    'findById_User',
    'findById_UserAuth',
    'update_Session', // Only allow one session update per request
    'update_RefreshToken',
    'update_User', // For last activity updates
  ]);

  // Operations that should NEVER be cached (always hit DB)
  private readonly NO_CACHE_OPERATIONS = new Set([
    'create',
    'delete',
    'save', // New entity creation
  ]);

  /**
   * Generate cache key based on operation, entity, and parameters
   */
  private generateKey(entityType: string, operation: string, params: unknown): string {
    const paramHash = this.hashParams(params);

    return `${entityType}:${operation}:${paramHash}`;
  }

  /**
   * Simple hash function for parameters
   */
  private hashParams(params: unknown): string {
    if (!params) return 'no-params';

    try {
      const str = JSON.stringify(params, Object.keys(params).sort());
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32-bit integer
      }

      return hash.toString(36);
    } catch {
      return 'invalid-params';
    }
  }

  /**
   * Check if operation should be cached
   */
  private shouldCache(entityType: string, operation: string): boolean {
    const operationKey = `${operation}_${entityType}`;

    // Never cache write operations
    if (this.NO_CACHE_OPERATIONS.has(operation)) {
      return false;
    }

    // For sensitive operations, only prevent exact duplicates
    if (this.SENSITIVE_OPERATIONS.has(operationKey) || this.SENSITIVE_OPERATIONS.has(operation)) {
      return true; // Allow caching but with special handling
    }

    // Cache all read operations
    return (
      operation.startsWith('find') || operation.startsWith('get') || operation.startsWith('exists')
    );
  }

  /**
   * Check if operation is sensitive (limited caching)
   */
  private isSensitiveOperation(entityType: string, operation: string): boolean {
    const operationKey = `${operation}_${entityType}`;

    return this.SENSITIVE_OPERATIONS.has(operationKey) || this.SENSITIVE_OPERATIONS.has(operation);
  }

  /**
   * Get cached result if available
   */
  get<T>(entityType: string, operation: string, params: unknown): T | undefined {
    if (!this.shouldCache(entityType, operation)) {
      return undefined;
    }

    const key = this.generateKey(entityType, operation, params);
    const cached = this.cache.get(key);

    if (cached !== undefined) {
      const metadata = this.cacheMetadata.get(key);
      const isSensitive = this.isSensitiveOperation(entityType, operation);

      // For sensitive operations, only use cache within very short timeframe (same request cycle)
      if (isSensitive && metadata) {
        const age = Date.now() - metadata.timestamp;
        if (age > 100) {
          // 100ms max for sensitive data
          this.cache.delete(key);
          this.cacheMetadata.delete(key);

          return undefined;
        }
      }

      return cached as T;
    }

    return undefined;
  }

  /**
   * Store result in cache
   */
  set<T>(entityType: string, operation: string, params: unknown, value: T): void {
    if (!this.shouldCache(entityType, operation)) {
      return;
    }

    const key = this.generateKey(entityType, operation, params);

    // For update operations on sensitive entities, only allow one per request
    if (operation.startsWith('update') && this.isSensitiveOperation(entityType, operation)) {
      // Check if we already have an update cached for this entity type
      const existingUpdateKey = Array.from(this.cacheMetadata.keys()).find(k => {
        const meta = this.cacheMetadata.get(k);

        return meta?.entityType === entityType && meta?.operation.startsWith('update');
      });

      if (existingUpdateKey && existingUpdateKey !== key) {
        // Skip caching if different update already exists
        return;
      }
    }

    this.cache.set(key, value);
    this.cacheMetadata.set(key, {
      timestamp: Date.now(),
      entityType,
      operation,
    });
  }

  /**
   * Invalidate cache entries for specific entity type
   */
  invalidateEntity(entityType: string): void {
    const keysToDelete: string[] = [];

    this.cacheMetadata.forEach((metadata, key) => {
      if (metadata.entityType === entityType) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => {
      this.cache.delete(key);
      this.cacheMetadata.delete(key);
    });
  }

  /**
   * Invalidate specific operation cache
   */
  invalidateOperation(entityType: string, operation: string): void {
    const keysToDelete: string[] = [];

    this.cacheMetadata.forEach((metadata, key) => {
      if (metadata.entityType === entityType && metadata.operation === operation) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => {
      this.cache.delete(key);
      this.cacheMetadata.delete(key);
    });
  }

  /**
   * Get cache statistics for debugging
   */
  getStats(): {
    totalEntries: number;
    entitiesCached: string[];
    operationsCached: string[];
    sensitiveEntriesCount: number;
  } {
    const entities = new Set<string>();
    const operations = new Set<string>();
    let sensitiveCount = 0;

    this.cacheMetadata.forEach(metadata => {
      entities.add(metadata.entityType);
      operations.add(metadata.operation);

      if (this.isSensitiveOperation(metadata.entityType, metadata.operation)) {
        sensitiveCount++;
      }
    });

    return {
      totalEntries: this.cache.size,
      entitiesCached: Array.from(entities),
      operationsCached: Array.from(operations),
      sensitiveEntriesCount: sensitiveCount,
    };
  }

  /**
   * Clear all cache entries (called at end of request)
   */
  clear(): void {
    this.cache.clear();
    this.cacheMetadata.clear();
  }

  /**
   * Check if cache contains entry
   */
  has(entityType: string, operation: string, params: unknown): boolean {
    if (!this.shouldCache(entityType, operation)) {
      return false;
    }

    const key = this.generateKey(entityType, operation, params);

    return this.cache.has(key);
  }
}
