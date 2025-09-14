import { ProductCatalog } from '@core/entities/product-catalog.entity';
import { IProductCatalogResponse } from '@application/dtos/_responses/product-catalog/product-catalog.response';
import { IProductMediaResponse } from '@application/dtos/_responses/product-media/product-media.response';

export class ProductCatalogMapper {
  static toResponse(
    productCatalog: ProductCatalog,
    media: IProductMediaResponse[] = [],
    companyCurrency: string = 'USD',
    companyLanguage: string = 'en-US',
  ): IProductCatalogResponse {
    const listPrice = productCatalog.listPrice?.getValue() ?? null;
    const listPriceFormatted = productCatalog.listPrice
      ? productCatalog.listPrice.getFormattedValue(companyCurrency, companyLanguage)
      : null;

    return {
      id: productCatalog.id.getValue(),
      industry: productCatalog.industry,
      productService: productCatalog.productService,
      type: productCatalog.type,
      subcategory: productCatalog.subcategory,
      listPrice,
      listPriceFormatted,
      paymentOptions: productCatalog.paymentOptions,
      description: productCatalog.description,
      link: productCatalog.link,
      sourceFileName: productCatalog.sourceFileName,
      sourceRowNumber: productCatalog.sourceRowNumber,
      langCode: productCatalog.langCode,
      companyId: productCatalog.companyId.getValue(),
      createdBy: productCatalog.createdBy.getValue(),
      updatedBy: productCatalog.updatedBy?.getValue(),
      createdAt: productCatalog.createdAt,
      updatedAt: productCatalog.updatedAt,
      isVisible: productCatalog.isVisible,
      media,
    };
  }

  static toResponseList(
    productCatalogs: {
      catalog: ProductCatalog;
      media: IProductMediaResponse[];
      currency?: string;
      language?: string;
    }[],
  ): IProductCatalogResponse[] {
    return productCatalogs.map(item =>
      this.toResponse(item.catalog, item.media, item.currency || 'USD', item.language || 'en-US'),
    );
  }
}
