import { PaymentOption } from '@prisma/client';
import { IProductMediaResponse } from '../product-media/product-media.response';

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
  companyId: string;
  createdBy: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
  // Product media with file information
  media: IProductMediaResponse[];
}
