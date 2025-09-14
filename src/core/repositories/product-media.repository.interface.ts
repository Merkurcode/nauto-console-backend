import { ProductMedia } from '@core/entities/product-media.entity';
import { FileType } from '@prisma/client';

export interface IProductMediaRepository {
  create(productMedia: ProductMedia): Promise<ProductMedia>;
  findById(id: string): Promise<ProductMedia | null>;
  findByIdAndCompany(id: string, companyId: string, cache?: boolean): Promise<ProductMedia | null>;
  findByProductId(productId: string, companyId: string): Promise<ProductMedia[]>;
  findByFileAndProduct(
    fileId: string,
    productId: string,
    companyId: string,
  ): Promise<ProductMedia | null>;
  findFavoriteByProductId(productId: string, companyId: string): Promise<ProductMedia | null>;
  findByFileType(fileType: FileType, companyId: string): Promise<ProductMedia[]>;
  update(productMedia: ProductMedia): Promise<ProductMedia>;
  delete(id: string, companyId: string): Promise<void>;
  clearFavoriteForProductByType(
    productId: string,
    companyId: string,
    fileType: FileType,
  ): Promise<void>;
}
