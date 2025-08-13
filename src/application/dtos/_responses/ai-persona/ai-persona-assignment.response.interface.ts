export interface IAIPersonaAssignmentResponse {
  id: string;
  companyId: string;
  aiPersonaId: string;
  isActive: boolean;
  assignedAt: Date;
  assignedBy: string | null;
}
