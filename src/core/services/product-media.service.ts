import { Injectable, Inject } from '@nestjs/common';
import { ProductMedia } from '@core/entities/product-media.entity';
import { ProductMediaId } from '@core/value-objects/product-media-id.vo';
import { IProductMediaRepository } from '@core/repositories/product-media.repository.interface';
import { IProductCatalogRepository } from '@core/repositories/product-catalog.repository.interface';
import { IFileRepository } from '@core/repositories/file.repository.interface';
import {
  PRODUCT_MEDIA_REPOSITORY,
  PRODUCT_CATALOG_REPOSITORY,
  FILE_REPOSITORY,
  USER_REPOSITORY,
  LOGGER_SERVICE,
  STORAGE_SERVICE,
} from '@shared/constants/tokens';
import { FileType } from '@prisma/client';
import {
  ProductMediaNotFoundException,
  UnauthorizedMediaAccessException,
} from '@core/exceptions/product-media.exceptions';
import {
  EntityNotFoundException,
  FileAccessDeniedException,
  ForbiddenActionException,
} from '@core/exceptions/domain-exceptions';
import { FileOperationsService } from '@core/services/file-operations.service';
import { ILogger } from '@core/interfaces/logger.interface';
import { IUserRepository } from '@core/repositories/user.repository.interface';
import { FileAccessControlService } from './file-access-control.service';
import { CommonFolder } from '@shared/types/storage-areas.types';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { IStorageService } from '@core/repositories/storage.service.interface';

@Injectable()
export class ProductMediaService {
  constructor(
    @Inject(PRODUCT_MEDIA_REPOSITORY)
    private readonly productMediaRepository: IProductMediaRepository,
    @Inject(PRODUCT_CATALOG_REPOSITORY)
    private readonly productCatalogRepository: IProductCatalogRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(STORAGE_SERVICE)
    private readonly storageService: IStorageService,
    @Inject(FILE_REPOSITORY)
    private readonly fileRepository: IFileRepository,
    private readonly fileOperationsService: FileOperationsService,
    private readonly fileAccessControlService: FileAccessControlService,
    @Inject(LOGGER_SERVICE)
    private readonly logger: ILogger,
  ) {
    this.logger.setContext(ProductMediaService.name);
  }

  async createProductMedia(data: {
    fileId: string;
    fav: boolean;
    productId: string;
    companyId: string;
    createdBy: string;
    description?: string;
    tags?: string;
  }): Promise<ProductMedia> {
    // Verify product catalog exists and belongs to company
    const productCatalog = await this.productCatalogRepository.findById(
      data.productId,
      data.companyId,
    );
    if (!productCatalog) {
      throw new EntityNotFoundException('ProductCatalog', data.productId);
    }

    // Check if media already exists for this fileId and productId
    const existingMedia = await this.productMediaRepository.findByFileAndProduct(
      data.fileId,
      data.productId,
      data.companyId,
    );

    if (existingMedia) {
      // Media already exists, only update fav if different
      this.logger.log(
        `Product media already exists for fileId: ${data.fileId} and productId: ${data.productId}, updating fav status`,
      );

      if (existingMedia.fav !== data.fav) {
        // If setting as favorite, clear existing favorite for this file type first
        if (data.fav) {
          await this.productMediaRepository.clearFavoriteForProductByType(
            data.productId,
            data.companyId,
            existingMedia.fileType,
          );
          existingMedia.setFavorite(data.createdBy);
        } else {
          existingMedia.unsetFavorite(data.createdBy);
        }

        return await this.productMediaRepository.update(existingMedia);
      }

      // Return existing media without changes
      return existingMedia;
    }

    // Get file info to determine type automatically
    const file = await this.fileRepository.findById(data.fileId);
    if (!file) {
      this.logger.error(`File not found: ${data.fileId}`);
      throw new EntityNotFoundException('File', data.fileId);
    }

    const fileOwner = await this.userRepository.findById(file.userId);
    if (!fileOwner) {
      throw new EntityNotFoundException('User', file.userId);
    }

    if (!fileOwner.companyId.equals(CompanyId.fromString(data.companyId))) {
      throw new ForbiddenActionException('You can only access your assigned company resources');
    }

    if (
      !this.fileAccessControlService.isCommonAreaFile(file, data.companyId, CommonFolder.PRODUCTS)
    ) {
      throw new FileAccessDeniedException(data.fileId, data.createdBy);
    }

    // Determine file type automatically based on MIME type
    const fileType = ProductMedia.mapMimeTypeToFileType(file.mimeType);

    this.logger.log(
      `Auto-determined file type: ${fileType} for MIME type: ${file.mimeType} (fileId: ${data.fileId})`,
    );

    // If setting as favorite, clear existing favorite for this file type
    if (data.fav) {
      await this.productMediaRepository.clearFavoriteForProductByType(
        data.productId,
        data.companyId,
        fileType,
      );
    }

    const productMedia = ProductMedia.create({
      ...data,
      fileType,
    });

    return await this.productMediaRepository.create(productMedia);
  }

  async updateProductMedia(
    id: string,
    data: {
      fileName?: string;
      fav?: boolean;
      description?: string;
      tags?: string;
    },
    companyId: string,
    userId: string,
  ): Promise<ProductMedia> {
    const productMedia = await this.productMediaRepository.findByIdAndCompany(id, companyId);
    if (!productMedia) {
      throw new ProductMediaNotFoundException(id);
    }

    if (!productMedia.belongsToCompany(companyId)) {
      throw new UnauthorizedMediaAccessException();
    }

    // Authorization is handled at command level - any company user can modify

    let previousFavoriteMediaId: ProductMediaId | undefined;

    // If setting as favorite, get current favorite BEFORE clearing it
    if (data.fav === true) {
      const currentFavorite = await this.productMediaRepository.findFavoriteByProductId(
        productMedia.productId.getValue(),
        companyId,
      );
      if (currentFavorite && currentFavorite.id.getValue() !== id) {
        previousFavoriteMediaId = currentFavorite.id;
      }

      // Now clear existing favorite for the same file type
      await this.productMediaRepository.clearFavoriteForProductByType(
        productMedia.productId.getValue(),
        companyId,
        productMedia.fileType,
      );
    }

    // Update file name if provided (preserve original extension)
    if (data.fileName !== undefined && data.fileName.trim() !== '') {
      try {
        // Get current file info to preserve extension
        const file = await this.fileRepository.findById(productMedia.fileId.getValue());
        if (!file) {
          throw new EntityNotFoundException('File', productMedia.fileId.getValue());
        }
        const currentFileName = file.filename;
        const fileExtension = currentFileName.substring(currentFileName.lastIndexOf('.'));

        // Remove extension from new name if provided, then add original extension
        const newNameWithoutExt = data.fileName.trim().replace(/\.[^/.]+$/, '');
        const finalFileName = `${newNameWithoutExt}${fileExtension}`;

        if (finalFileName !== currentFileName) {
          await this.fileOperationsService.renameFile({
            fileId: productMedia.fileId.getValue(),
            newFilename: finalFileName,
            userId,
            companyId,
            commonArea: true,
            skipRenameExtValidation: true,
          });

          // Emit domain event through entity method
          productMedia.updateFileName(finalFileName, currentFileName, userId);

          this.logger.log(
            `File name updated in storage: ${productMedia.fileId.getValue()} from "${currentFileName}" to "${finalFileName}" by user: ${userId}`,
          );
        }
      } catch (error) {
        this.logger.error(
          `Failed to update file name in storage: ${productMedia.fileId.getValue()}, error: ${error.message}`,
        );
        throw new Error(`Failed to update file name: ${error.message}`);
      }
    }

    // Update description
    if (data.description !== undefined) {
      productMedia.updateDescription(data.description, userId);
    }

    // Update tags
    if (data.tags !== undefined) {
      productMedia.updateTags(data.tags, userId);
    }

    // Update favorite status
    if (data.fav !== undefined) {
      if (data.fav) {
        productMedia.setFavorite(userId, previousFavoriteMediaId);
      } else {
        productMedia.unsetFavorite(userId);
      }
    }

    return await this.productMediaRepository.update(productMedia);
  }

  async deleteProductMedia(id: string, companyId: string, userId: string): Promise<void> {
    let productMedia = await this.productMediaRepository.findByIdAndCompany(id, companyId, false);
    if (!productMedia) {
      return;
    }

    if (!productMedia.belongsToCompany(companyId)) {
      throw new UnauthorizedMediaAccessException();
    }

    const file = await this.fileRepository.findById(productMedia.fileId.getValue());
    if (file) {
      // Authorization is handled at command level - any company user can modify

      try {
        // First: Try to delete file from storage
        await this.fileOperationsService.deleteFile({
          fileId: file.id,
          userId,
          hardDelete: true,
          commonArea: true,
        });
        this.logger.log(
          `File deleted from storage: ${productMedia.fileId.getValue()} by user: ${userId}`,
        );
      } catch (deleteError) {
        // Check if file exists physically before deciding to throw error
        try {
          const fileExists = await this.storageService.objectExists(
            file.bucket,
            file.objectKey.getValue(),
          );

          if (fileExists) {
            // File exists but couldn't be deleted - this is a real error
            this.logger.error(
              `Failed to delete existing file from storage: ${productMedia.fileId.getValue()}, error: ${deleteError.message}`,
            );
            throw new Error(
              `Failed to delete file from storage: ${productMedia.fileId.getValue()}, error: ${deleteError.message}`,
            );
          } else {
            // File doesn't exist, continue with database cleanup
            this.logger.warn(
              `File not found in storage, continuing with database cleanup: ${productMedia.fileId.getValue()}`,
            );
          }
        } catch (checkError) {
          // Error checking file existence - throw the error
          this.logger.error(
            `Error checking file existence: ${productMedia.fileId.getValue()}, error: ${checkError.message}`,
          );
          throw new Error(
            `Failed to verify file existence: ${productMedia.fileId.getValue()}, error: ${checkError.message}`,
          );
        }
      }
    } else {
      // File doesn't exist, continue with database cleanup
      this.logger.warn(
        `File not found in database, continuing with database cleanup: ${productMedia.fileId.getValue()}`,
      );
    }

    // Mark entity for deletion (emits domain event)
    productMedia.markForDeletion(userId);

    // Finally: Delete record from database
    productMedia = await this.productMediaRepository.findByIdAndCompany(id, companyId, true);
    if (!productMedia) {
      this.logger.log(`Product media deleted: ${id} by user: ${userId} in company: ${companyId}`);

      return;
    }

    await this.productMediaRepository.delete(id, companyId);

    this.logger.log(`Product media deleted: ${id} by user: ${userId} in company: ${companyId}`);
  }

  async getProductMediaByProductId(productId: string, companyId: string): Promise<ProductMedia[]> {
    // Verify product catalog exists and belongs to company
    const productCatalog = await this.productCatalogRepository.findById(productId, companyId);
    if (!productCatalog) {
      throw new EntityNotFoundException('ProductCatalog', productId);
    }

    return await this.productMediaRepository.findByProductId(productId, companyId);
  }

  async getProductMediaById(id: string, companyId: string): Promise<ProductMedia> {
    const productMedia = await this.productMediaRepository.findByIdAndCompany(id, companyId);
    if (!productMedia) {
      throw new ProductMediaNotFoundException(id);
    }

    if (!productMedia.belongsToCompany(companyId)) {
      throw new UnauthorizedMediaAccessException();
    }

    return productMedia;
  }

  async getFavoriteMediaForProduct(
    productId: string,
    companyId: string,
  ): Promise<ProductMedia | null> {
    return await this.productMediaRepository.findFavoriteByProductId(productId, companyId);
  }

  async getMediaByFileType(fileType: FileType, companyId: string): Promise<ProductMedia[]> {
    return await this.productMediaRepository.findByFileType(fileType, companyId);
  }
}
