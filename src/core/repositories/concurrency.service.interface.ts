/**
 * Concurrency service interface for managing upload limits
 *
 * This interface defines the contract for managing concurrent upload
 * limits using Redis as the backend store.
 *
 * Following Clean Architecture principles, this interface is defined
 * in the domain layer and implemented in the infrastructure layer.
 */

export interface IConcurrencyService {
  /**
   * Attempts to acquire a slot for a concurrent upload
   * @param userId User identifier
   * @param maxConcurrent Maximum allowed concurrent uploads
   * @param ttlSeconds Time-to-live for the slot in seconds (default: 7200 = 2 hours)
   * @returns Promise with acquisition result and current count
   */
  tryAcquireSlot(
    userId: string,
    maxConcurrent: number,
    ttlSeconds?: number,
  ): Promise<{ acquired: boolean; current: number }>;

  /**
   * Releases a slot for a user
   * @param userId User identifier
   * @returns Promise<number> Number of remaining slots
   */
  releaseSlot(userId: string): Promise<number>;

  /**
   * Gets current number of active uploads for a user
   * @param userId User identifier
   * @returns Promise<number> Number of active uploads
   */
  getCurrentCount(userId: string): Promise<number>;

  /**
   * Gets current value of a specific key
   * @param key Redis key to check
   * @returns Promise<number> Current value
   */
  getCurrentValue(key: string): Promise<number>;

  /**
   * Clears all slots for a user (admin operation)
   * @param userId User identifier
   * @returns Promise<void>
   */
  clearUserSlots(userId: string): Promise<void>;

  /**
   * Gets statistics about concurrent uploads
   * @returns Promise with statistics
   */
  getStats(): Promise<{
    totalActiveUsers: number;
    totalActiveUploads: number;
    averageUploadsPerUser: number;
  }>;

  /**
   * Sets a slot with a specific value (for locking)
   * @param key Lock key
   * @param value Lock value
   * @param ttlSeconds Time-to-live in seconds
   * @returns Promise<boolean> true if slot was set, false if already exists
   */
  setSlot(key: string, value: string, ttlSeconds: number): Promise<boolean>;

  /**
   * Releases slot with value verification (secure unlock)
   * @param key Lock key
   * @param value Lock value for verification
   * @returns Promise<boolean> true if successfully released
   */
  releaseSlotWithValue(key: string, value: string): Promise<boolean>;

  /**
   * Gets information about a slot
   * @param key Slot key
   * @returns Promise with slot information
   */
  getSlotInfo(key: string): Promise<{ exists: boolean; value?: string }>;

  /**
   * Extends TTL for active uploads (heartbeat)
   * @param userId User identifier
   * @param ttlSeconds TTL to extend to
   * @returns Promise<boolean> true if heartbeat successful
   */
  heartbeat(userId: string, ttlSeconds?: number): Promise<boolean>;

  /**
   * Health check for the concurrency service
   * @returns Promise<boolean> true if service is healthy
   */
  healthCheck(): Promise<boolean>;

  /**
   * Refreshes TTL for a slot only if the value matches (CAS)
   * @param key Slot key
   * @param value Expected value for verification
   * @param ttlSeconds New TTL in seconds
   * @returns Promise<boolean> true if TTL was refreshed
   */
  refreshSlotIfValue?(key: string, value: string, ttlSeconds: number): Promise<boolean>;

  adjustCounterWithTtl(key: string, delta: number, ttlSeconds: number): Promise<number>;

  /**
   * Safely decrements a counter only if there's enough value reserved
   * Prevents negative values by checking current value before decrementing
   * @param key Counter key
   * @param decrementAmount Amount to decrement
   * @param ttlSeconds TTL to maintain on the key
   * @returns Promise with operation result
   */
  safeDecrementCounter(
    key: string,
    decrementAmount: number,
    ttlSeconds: number,
  ): Promise<{
    success: boolean;
    remainingValue: number;
    wasFullyReleased: boolean;
  }>;

  deleteKey(key: string): Promise<void>;
  userKey(userId: string): string;
  activeUsersSet(): string;
}
