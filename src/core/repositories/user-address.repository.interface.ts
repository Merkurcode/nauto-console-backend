import { UserAddress } from '@core/entities/user-address.entity';
import { UserAddressId } from '@core/value-objects/user-address-id.vo';
import { UserId } from '@core/value-objects/user-id.vo';

/**
 * User Address repository interface
 *
 * Implementations:
 * - {@link UserAddress} - Production Prisma/PostgreSQL implementation
 */
export interface IUserAddressRepository {
  findById(id: UserAddressId): Promise<UserAddress | null>;
  findByUserId(userId: UserId): Promise<UserAddress | null>;
  create(userAddress: UserAddress): Promise<UserAddress>;
  update(userAddress: UserAddress): Promise<UserAddress>;
  delete(id: UserAddressId): Promise<void>;
}
