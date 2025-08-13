export interface IAIPersonaResponse {
  id: string;
  name: string;
  keyName: string;
  tone: Record<string, string>;
  personality: Record<string, string>;
  objective: Record<string, string>;
  shortDetails: Record<string, string>;
  isDefault: boolean;
  companyId: string | null;
  isActive: boolean;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}
