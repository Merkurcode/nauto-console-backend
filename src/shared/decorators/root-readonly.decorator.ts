/* eslint-disable prettier/prettier */
import { SetMetadata } from '@nestjs/common';
import { RolesEnum } from '@shared/constants/enums';

export const ROOT_READONLY_KEY = RolesEnum.ROOT_READONLY;

/**
 * Decorator to mark endpoints that should deny write operations for root_readonly users
 * Root readonly users can only perform read operations
 */
export const DenyForRootReadOnly = () =>
  SetMetadata(ROOT_READONLY_KEY, true);