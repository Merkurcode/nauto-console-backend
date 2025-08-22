import { Injectable, Inject } from '@nestjs/common';
import { IFileRepository } from '@core/repositories/file.repository.interface';
import { UserStorageConfigService } from './user-storage-config.service';
import { FileLockService } from './file-lock.service';
import { IConcurrencyService } from '@core/repositories/concurrency.service.interface';
import { FILE_REPOSITORY, CONCURRENCY_SERVICE } from '@shared/constants/tokens';
import { ConcurrencyService } from '@infrastructure/services/concurrency.service';
import { ConfigService } from '@nestjs/config';

/**
 * Resultado de chequeo de cuota
 */
export interface IQuotaCheckResult {
  allowed: boolean;
  currentUsage: number; // bytes usados (incluye reservados cuando aplica)
  maxQuota: number; // bytes de cuota máxima
  availableSpace: number; // bytes disponibles (considerando reservas)
  reason?: string; // por qué no se permite
}

@Injectable()
export class FileQuotaService {
  /** Usa la MISMA hash-tag que ConcurrencyService para co-ubicar en el mismo slot de Redis Cluster */

  constructor(
    @Inject(FILE_REPOSITORY)
    private readonly fileRepository: IFileRepository,
    @Inject(CONCURRENCY_SERVICE)
    private readonly concurrencyService: IConcurrencyService,
    private readonly userStorageConfigService: UserStorageConfigService,
    private readonly fileLockService: FileLockService,
    private readonly configService: ConfigService,
  ) {}

  // ===========================================================================
  // API pública
  // ===========================================================================

  /**
   * Chequea y **reserva** cuota de forma atómica para un nuevo upload.
   * Si allowed=true, la reserva queda registrada con TTL.
   */
  async checkAndReserveQuota(
    userId: string,
    fileSize: number,
    _companyId?: string,
  ): Promise<IQuotaCheckResult> {
    if (!userId || !Number.isFinite(fileSize) || fileSize <= 0) {
      return {
        allowed: false,
        currentUsage: 0,
        maxQuota: 0,
        availableSpace: 0,
        reason: 'Invalid file size',
      };
    }

    return this.fileLockService.withQuotaLock(userId, async () => {
      const result = await this.performQuotaCheck(userId, fileSize, _companyId);

      if (result.allowed) {
        // Reserva atómica con TTL (sumamos y refrescamos TTL)
        await this.addReservation(userId, fileSize);
      }

      return result;
    });
  }

  /**
   * Libera una reserva previamente hecha (p. ej. al fallar o cancelar un upload).
   */
  async releaseReservedQuota(userId: string, fileSize: number): Promise<void> {
    if (!userId || !Number.isFinite(fileSize) || fileSize <= 0) return;

    return this.fileLockService.withQuotaLock(userId, async () => {
      await this.removeReservation(userId, fileSize);
    });
  }

  /**
   * Tras finalizar exitosamente un upload (persistido en BD),
   * se descuenta la reserva, ya que el uso “real” quedará reflejado en la BD.
   */
  async finalizeQuotaUsage(userId: string, fileSize: number): Promise<void> {
    if (!userId || !Number.isFinite(fileSize) || fileSize <= 0) return;

    return this.fileLockService.withQuotaLock(userId, async () => {
      await this.removeReservation(userId, fileSize);
    });
  }

  /**
   * Chequeo por lote (suma tamaños y realiza una única reserva).
   */
  async batchQuotaCheck(
    userId: string,
    fileSizes: number[],
    _companyId?: string,
  ): Promise<IQuotaCheckResult> {
    const totalSize = (fileSizes ?? []).reduce((sum, n) => sum + (Number.isFinite(n) ? n : 0), 0);

    return this.checkAndReserveQuota(userId, totalSize, _companyId);
  }

  /**
   * Consulta de uso + espacio disponible (considera reservas activas).
   * No crea ni borra reservas.
   */
  async getQuotaUsage(userId: string, _companyId?: string): Promise<IQuotaCheckResult> {
    const storageConfig = await this.userStorageConfigService.getUserStorageConfig(userId);
    if (!storageConfig) {
      return {
        allowed: false,
        currentUsage: 0,
        maxQuota: 0,
        availableSpace: 0,
        reason: 'No storage configuration found',
      };
    }

    const currentUsage = await this.fileRepository.getUserUsedBytes(userId);
    const currentReserved = await this.getReservedQuota(userId);
    const maxQuota = Number(storageConfig.getMaxStorageInBytes());
    const availableSpace = Math.max(0, maxQuota - currentUsage - currentReserved);

    return {
      allowed: availableSpace > 0,
      currentUsage: currentUsage + currentReserved, // mostramos el “uso” incluyendo lo reservado
      maxQuota,
      availableSpace,
    };
  }

  /**
   * Validación de tamaño por tier (si en un futuro agregas límites por archivo).
   * Ahora acepta todo tamaño positivo.
   */
  async validateFileSizeForTier(
    userId: string,
    fileSize: number,
    _companyId?: string,
  ): Promise<boolean> {
    if (!userId || !Number.isFinite(fileSize) || fileSize <= 0) return false;

    const storageConfig = await this.userStorageConfigService.getUserStorageConfig(userId);
    if (!storageConfig) return false;

    // Sin límites por archivo actualmente.
    return true;
  }

  /**
   * Operación admin: reset de las reservas del usuario.
   */
  async resetUserQuota(userId: string): Promise<void> {
    if (!userId) return;

    return this.fileLockService.withQuotaLock(
      userId,
      async () => {
        await this.concurrencyService.deleteKey(this.getReservedKey(userId)); // borra sin depender del valor
      },
      60_000, // timeout más largo para admin
    );
  }

  // ===========================================================================
  // Internos
  // ===========================================================================

  /**
   * Lógica de chequeo de cuota: uso actual + reservas + nuevo tamaño <= cuota,
   * y cuenta de archivos simultáneos no excede límite del tier.
   */
  private async performQuotaCheck(
    userId: string,
    fileSize: number,
    _companyId?: string,
  ): Promise<IQuotaCheckResult> {
    const storageConfig = await this.userStorageConfigService.getUserStorageConfig(userId);

    if (!storageConfig) {
      return {
        allowed: false,
        currentUsage: 0,
        maxQuota: 0,
        availableSpace: 0,
        reason: 'No storage configuration found for user',
      };
    }

    const currentUsage = await this.fileRepository.getUserUsedBytes(userId);
    const currentReserved = await this.getReservedQuota(userId);

    const maxQuota = Number(storageConfig.getMaxStorageInBytes());
    const availableSpaceNow = Math.max(0, maxQuota - currentUsage - currentReserved);
    const totalProjected = currentUsage + currentReserved + fileSize;

    if (totalProjected > maxQuota) {
      return {
        allowed: false,
        currentUsage,
        maxQuota,
        availableSpace: availableSpaceNow,
        reason: `File size ${fileSize} bytes would exceed storage quota. Available: ${availableSpaceNow} bytes (${currentReserved} bytes reserved)`,
      };
    }

    // Límite de uploads simultáneos/activos según tu dominio
    const currentFileCount = await this.fileRepository.getUserActiveUploadsCount(userId);
    const maxFileCount = storageConfig.maxSimultaneousFiles;

    if (currentFileCount >= maxFileCount) {
      return {
        allowed: false,
        currentUsage,
        maxQuota,
        availableSpace: availableSpaceNow,
        reason: `Maximum file count (${maxFileCount}) exceeded. Current: ${currentFileCount} files`,
      };
    }

    // OK: devolvemos espacio disponible descontando este archivo
    return {
      allowed: true,
      currentUsage,
      maxQuota,
      availableSpace: Math.max(0, availableSpaceNow - fileSize),
    };
  }

  /**
   * Lee reservas actuales desde Redis.
   */
  private async getReservedQuota(userId: string): Promise<number> {
    const reservedKey = this.getReservedKey(userId);
    const slotInfo = await this.concurrencyService.getSlotInfo(reservedKey);

    if (slotInfo.exists && slotInfo.value) {
      const n = parseInt(slotInfo.value, 10);

      return Number.isFinite(n) ? n : 0;
    }

    return 0;
  }

  /**
   * Suma una reserva y refresca TTL de forma atómica.
   */
  private async addReservation(userId: string, fileSize: number): Promise<void> {
    const reservedKey = this.getReservedKey(userId);
    const bookingTtlSec =
      this.configService.get<number>('storage.concurrency.bookingTtlSec', 7200) ?? 7200;
    await this.concurrencyService.adjustCounterWithTtl(reservedKey, +fileSize, bookingTtlSec);
  }

  /**
   * Resta una reserva (y elimina la key si queda <= 0) de forma atómica.
   */
  private async removeReservation(userId: string, fileSize: number): Promise<void> {
    const reservedKey = this.getReservedKey(userId);
    const bookingTtlSec =
      this.configService.get<number>('storage.concurrency.bookingTtlSec', 7200) ?? 7200;
    await this.concurrencyService.adjustCounterWithTtl(reservedKey, -fileSize, bookingTtlSec);
  }

  /**
   * Key de reservas por usuario (usa la misma hash-tag que ConcurrencyService).
   */
  private getReservedKey(userId: string): string {
    return `${ConcurrencyService.HASH_TAG}:quota:reserved:${userId}`;
  }
}
