export interface IMarketingCampaignResponse {
  id: string;
  startDate: Date;
  endDate: Date;
  utmName: string;
  referenceName: string;
  context: string;
  enabled: boolean;
  metaId: string | null;
  promotionPictureId: string | null;
  companyId: string;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}
