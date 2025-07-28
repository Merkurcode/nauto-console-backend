/* eslint-disable prettier/prettier */
import { applyDecorators } from '@nestjs/common';
import { DenyForRootReadOnly } from './root-readonly.decorator';
import { CanWrite, CanDelete } from './resource-permissions.decorator';

/**
 * Composite decorator for write operations that:
 * 1. Denies access for root_readonly users
 * 2. Requires write permission for the resource
 */
export const WriteOperation = (resource: string) =>
  applyDecorators(
    DenyForRootReadOnly(),
    CanWrite(resource),
  );

/**
 * Composite decorator for delete operations that:
 * 1. Denies access for root_readonly users
 * 2. Requires delete permission for the resource
 */
export const DeleteOperation = (resource: string) =>
  applyDecorators(
    DenyForRootReadOnly(),
    CanDelete(resource),
  );