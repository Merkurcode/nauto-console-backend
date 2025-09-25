export interface IDeactivateCompanyResponse {
  success: boolean;
  message: string;
  companyId: string;
  companyName: string;
  deactivatedAt: Date;
  deactivatedBy: string;
  affectedUsersCount: number;
  terminatedSessionsCount: number;
}
