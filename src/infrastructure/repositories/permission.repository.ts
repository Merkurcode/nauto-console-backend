import { Injectable } from '@nestjs/common';
import { Permission } from '@core/entities/permission.entity';
import { IPermissionRepository } from '@core/repositories/permission.repository.interface';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';
import { TransactionContextService } from '@infrastructure/database/prisma/transaction-context.service';
import { Permission as PrismaPermission } from '@prisma/client';
import { ResourceAction } from '@core/value-objects/resource-action.vo';
import { ActionType } from '@shared/constants/enums';
import { BaseRepository } from './base.repository';

@Injectable()
export class PermissionRepository
  extends BaseRepository<Permission>
  implements IPermissionRepository
{
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionContext: TransactionContextService,
  ) {
    super();
  }

  private get client() {
    return this.transactionContext.getTransactionClient() || this.prisma;
  }

  async findById(id: string): Promise<Permission | null> {
    return this.executeWithErrorHandling('findById', async () => {
      const permissionRecord = await this.client.permission.findUnique({
        where: { id },
      });

      if (!permissionRecord) {
        return null;
      }

      return this.mapToModel(permissionRecord);
    });
  }

  async findByName(name: string): Promise<Permission | null> {
    return this.executeWithErrorHandling('findByName', async () => {
      const permissionRecord = await this.client.permission.findUnique({
        where: { name },
      });

      if (!permissionRecord) {
        return null;
      }

      return this.mapToModel(permissionRecord);
    });
  }

  async findAll(): Promise<Permission[]> {
    return this.executeWithErrorHandling('findAll', async () => {
      const permissionRecords = await this.client.permission.findMany();

      return permissionRecords.map(record => this.mapToModel(record));
    });
  }

  async findAllOrderByName(): Promise<Permission[]> {
    return this.executeWithErrorHandling('findAllOrderByName', async () => {
      const permissionRecords = await this.client.permission.findMany({
        orderBy: { name: 'asc' },
      });

      return permissionRecords.map(record => this.mapToModel(record));
    });
  }

  async findByResource(resource: string): Promise<Permission[]> {
    return this.executeWithErrorHandling('findByResource', async () => {
      const permissionRecords = await this.client.permission.findMany({
        where: { resource },
      });

      return permissionRecords.map(record => this.mapToModel(record));
    });
  }

  async create(permission: Permission): Promise<Permission> {
    return this.executeWithErrorHandling('create', async () => {
      const createdPermission = await this.client.permission.create({
        data: {
          id: permission.id.getValue(),
          name: permission.name.getValue(),
          description: permission.description,
          resource: permission.resourceAction.getResource(),
          action: permission.resourceAction.getAction(),
        },
      });

      return this.mapToModel(createdPermission);
    });
  }

  async update(permission: Permission): Promise<Permission> {
    return this.executeWithErrorHandling('update', async () => {
      const updatedPermission = await this.client.permission.update({
        where: { id: permission.id.getValue() },
        data: {
          name: permission.name.getValue(),
          description: permission.description,
          resource: permission.resourceAction.getResource(),
          action: permission.resourceAction.getAction(),
        },
      });

      return this.mapToModel(updatedPermission);
    });
  }

  async delete(id: string): Promise<boolean> {
    return this.executeWithErrorHandling(
      'delete',
      async () => {
        await this.client.permission.delete({
          where: { id },
        });

        return true;
      },
      false,
    );
  }

  private mapToModel(record: PrismaPermission): Permission {
    // Create value objects from primitive values
    const resourceAction = new ResourceAction(record.resource, record.action as ActionType);

    return Permission.fromData({
      id: record.id,
      resourceAction,
      description: record.description,
      excludeRoles: record.excludeRoles as string | null,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
