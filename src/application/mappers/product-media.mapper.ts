import { ProductMedia } from '@core/entities/product-media.entity';
import { IProductMediaResponse } from '@application/dtos/_responses/product-media/product-media.response';
import { IFileResponse } from '@application/dtos/_responses/storage/storage.response.interface';

export class ProductMediaMapper {
  static toResponse(productMedia: ProductMedia, fileInfo: IFileResponse): IProductMediaResponse {
    return {
      id: productMedia.id.getValue(),
      fileId: productMedia.fileId.getValue(),
      fileType: productMedia.fileType,
      fav: productMedia.fav,
      productId: productMedia.productId.getValue(),
      companyId: productMedia.companyId.getValue(),
      createdBy: productMedia.createdBy.getValue(),
      description: productMedia.description,
      tags: productMedia.tags,
      createdAt: productMedia.createdAt,
      updatedAt: productMedia.updatedAt,
      file: {
        id: fileInfo.id,
        filename: fileInfo.filename,
        originalName: fileInfo.originalName,
        path: fileInfo.path,
        objectKey: fileInfo.objectKey,
        mimeType: fileInfo.mimeType,
        size: fileInfo.size,
        bucket: fileInfo.bucket,
        userId: fileInfo.userId,
        isPublic: fileInfo.isPublic,
        status: fileInfo.status,
        uploadId: fileInfo.uploadId,
        etag: fileInfo.etag,
        createdAt: fileInfo.createdAt,
        updatedAt: fileInfo.updatedAt,
        signedUrl: fileInfo.signedUrl,
        signedUrlExpiresAt: fileInfo.signedUrlExpiresAt,
      },
    };
  }

  static toResponseList(
    productMediaList: { media: ProductMedia; file: IFileResponse }[],
  ): IProductMediaResponse[] {
    return productMediaList.map(item => this.toResponse(item.media, item.file));
  }
}
