export interface IReactivateCompanyResponse {
  success: boolean;
  message: string;
  companyId: string;
  companyName: string;
  reactivatedAt: Date;
  reactivatedBy: string;
  reactivatedUsersCount: number;
}
