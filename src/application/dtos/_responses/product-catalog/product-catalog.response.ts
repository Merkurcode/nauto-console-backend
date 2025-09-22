import { PaymentOption } from '@prisma/client';
import { IProductMediaResponse } from '../product-media/product-media.response';
import { ApiProperty } from '@nestjs/swagger';

export interface IProductCatalogResponse {
  id: string;
  industry: string;
  productService: string;
  type: string;
  subcategory: string;
  listPrice: number | null;
  listPriceFormatted: string | null; // Formatted price with company currency
  paymentOptions: PaymentOption[];
  description?: string;
  link?: string;
  sourceFileName?: string;
  sourceRowNumber?: number;
  langCode?: string;
  companyId: string;
  createdBy: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
  isVisible: boolean;
  // Product media with file information
  media: IProductMediaResponse[];
}

export interface ISearchProductCatalogResponse {
  id: string;
  industry: string;
  productService: string;
  type: string;
  subcategory: string;
  listPrice: number;
  paymentOptions: PaymentOption[];
  description: string;
  companyId: string;
  createdBy: string;
  updatedBy: string;
  link: string;
  sourceFileName: string;
  sourceRowNumber: number;
  langCode: string;
  bulkRequestId: string;
  isVisible: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  rank: number;
}

export interface ISearchProductsResponse {
  products: ISearchProductCatalogResponse[];
  totalCount: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export class SearchProductsResponseDto implements ISearchProductsResponse {
  @ApiProperty({ description: 'Array of products', type: 'array' })
  products: ISearchProductCatalogResponse[];

  @ApiProperty({ description: 'Total number of matching products' })
  totalCount: number;

  @ApiProperty({ description: 'Number of results returned' })
  limit: number;

  @ApiProperty({ description: 'Number of results skipped' })
  offset: number;

  @ApiProperty({ description: 'Whether there are more results available' })
  hasMore: boolean;
}
