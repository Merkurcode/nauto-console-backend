export interface ICompanyAIPersonaAssignment {
  id: string;
  companyId: string;
  aiPersonaId: string;
  isActive: boolean;
  assignedAt: Date;
  assignedBy: string | null;
}

/**
 * Company AI Persona repository interface
 *
 * Implementations:
 * - {@link CompanyAIPersona} - Production Prisma/PostgreSQL implementation
 */
export interface ICompanyAIPersonaRepository {
  /**
   * Find company assignment by company ID
   */
  findByCompanyId(companyId: string): Promise<ICompanyAIPersonaAssignment | null>;

  /**
   * Find all company assignments for a specific AI Persona
   */
  findAllByAIPersonaId(aiPersonaId: string): Promise<ICompanyAIPersonaAssignment[]>;

  /**
   * Assign AI Persona to a company
   */
  assignAIPersonaToCompany(
    companyId: string,
    aiPersonaId: string,
    assignedBy: string,
  ): Promise<ICompanyAIPersonaAssignment>;

  /**
   * Deactivate company AI Persona assignment
   */
  deactivateCompanyAIPersona(companyId: string): Promise<boolean>;

  /**
   * Remove company AI Persona assignment
   */
  removeCompanyAIPersona(companyId: string): Promise<boolean>;

  /**
   * Remove all assignments for a specific AI Persona
   * Used when default persona becomes inactive
   * @param aiPersonaId The AI Persona ID
   * @returns Number of assignments removed
   */
  removeAllAssignmentsForPersona(aiPersonaId: string): Promise<number>;

  /**
   * Update the active status of a company's AI Persona assignment
   * @param companyId The company ID
   * @param isActive The new active status
   * @returns The updated assignment
   */
  updateAssignmentStatus(
    companyId: string,
    isActive: boolean,
  ): Promise<ICompanyAIPersonaAssignment>;
}
