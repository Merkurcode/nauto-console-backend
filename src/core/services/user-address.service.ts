import { Injectable, Inject } from '@nestjs/common';
import { UserAddress } from '@core/entities/user-address.entity';
import { IUserAddressRepository } from '@core/repositories/user-address.repository.interface';
import { USER_ADDRESS_REPOSITORY } from '@shared/constants/tokens';
import { UserId } from '@core/value-objects/user-id.vo';
import { UserAddressId } from '@core/value-objects/user-address-id.vo';
import { CountryId } from '@core/value-objects/country-id.vo';
import { StateId } from '@core/value-objects/state-id.vo';
import { EntityNotFoundException } from '@core/exceptions/domain-exceptions';

@Injectable()
export class UserAddressService {
  constructor(
    @Inject(USER_ADDRESS_REPOSITORY)
    private readonly userAddressRepository: IUserAddressRepository,
  ) {}

  async createUserAddress(
    userId: UserId,
    addressData: {
      countryId?: CountryId;
      stateId?: StateId;
      city?: string;
      street?: string;
      exteriorNumber?: string;
      interiorNumber?: string;
      postalCode?: string;
    },
  ): Promise<UserAddress> {
    // Check if address already exists
    const existingAddress = await this.userAddressRepository.findByUserId(userId);
    if (existingAddress) {
      throw new Error('User address already exists');
    }

    const address = UserAddress.create({
      userId,
      ...addressData,
    });

    return await this.userAddressRepository.create(address);
  }

  async updateUserAddress(
    userAddressId: UserAddressId,
    updates: {
      countryId?: CountryId;
      stateId?: StateId;
      city?: string;
      street?: string;
      exteriorNumber?: string;
      interiorNumber?: string;
      postalCode?: string;
    },
  ): Promise<UserAddress> {
    const address = await this.userAddressRepository.findById(userAddressId);
    if (!address) {
      throw new EntityNotFoundException('UserAddress', userAddressId.getValue());
    }

    address.updateFullAddress(updates);

    return await this.userAddressRepository.update(address);
  }

  async getUserAddress(userId: UserId): Promise<UserAddress | null> {
    return await this.userAddressRepository.findByUserId(userId);
  }

  async getUserAddressById(addressId: UserAddressId): Promise<UserAddress | null> {
    return await this.userAddressRepository.findById(addressId);
  }

  async deleteUserAddress(userAddressId: UserAddressId): Promise<void> {
    const address = await this.userAddressRepository.findById(userAddressId);
    if (!address) {
      throw new EntityNotFoundException('UserAddress', userAddressId.getValue());
    }

    await this.userAddressRepository.delete(userAddressId);
  }

  async validateAddress(userAddressId: UserAddressId): Promise<boolean> {
    const address = await this.userAddressRepository.findById(userAddressId);
    if (!address) {
      return false;
    }

    return address.hasCompleteAddress();
  }
}
