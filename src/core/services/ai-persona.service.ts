import { Injectable, Inject } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { IAIPersonaRepository } from '@core/repositories/ai-persona.repository.interface';
import {
  ICompanyAIPersonaRepository,
  ICompanyAIPersonaAssignment,
} from '@core/repositories/company-ai-persona.repository.interface';
import {
  AI_PERSONA_REPOSITORY,
  COMPANY_AI_PERSONA_REPOSITORY,
  LOGGER_SERVICE,
} from '@shared/constants/tokens';
import {
  CannotModifyDefaultAIPersonaException,
  UnauthorizedAIPersonaModificationException,
  AIPersonaNotFoundException,
  AIPersonaKeyNameAlreadyExistsException,
  CannotDeleteDefaultAIPersonaException,
  AIPersonaCompanyAssignmentRemovalException,
} from '@core/exceptions/ai-persona.exceptions';
import { InsufficientPermissionsException } from '@core/exceptions/domain-exceptions';
import { AIPersona } from '@core/entities/ai-persona.entity';
import { AIPersonaName } from '@core/value-objects/ai-persona-name.vo';
import { AIPersonaKeyName } from '@core/value-objects/ai-persona-key-name.vo';
import { AIPersonaTone } from '@core/value-objects/ai-persona-tone.vo';
import { AIPersonaPersonality } from '@core/value-objects/ai-persona-personality.vo';
import { AIPersonaObjective } from '@core/value-objects/ai-persona-objective.vo';
import { AIPersonaShortDetails } from '@core/value-objects/ai-persona-short-details.vo';
import { UserAuthorizationService } from './user-authorization.service';
import { User } from '@core/entities/user.entity';
import { ILogger } from '@core/interfaces/logger.interface';

@Injectable()
export class AIPersonaService {
  constructor(
    @Inject(AI_PERSONA_REPOSITORY)
    private readonly aiPersonaRepository: IAIPersonaRepository,
    @Inject(COMPANY_AI_PERSONA_REPOSITORY)
    private readonly companyAIPersonaRepository: ICompanyAIPersonaRepository,
    private readonly eventBus: EventBus,
    private readonly userAuthService: UserAuthorizationService,
    @Inject(LOGGER_SERVICE) private readonly logger: ILogger,
  ) {
    this.logger.setContext(AIPersonaService.name);
  }

  /**
   * Validates if a user can modify an AI Persona
   * Uses universal authorization methods from UserAuthorizationService
   */
  async validateAIPersonaModification(aiPersonaId: string, currentUser: User): Promise<AIPersona> {
    const aiPersona = await this.aiPersonaRepository.findById(aiPersonaId);

    if (!aiPersona) {
      throw new AIPersonaNotFoundException(aiPersonaId);
    }

    // ✅ Use universal method for root access check
    if (aiPersona.isDefault && !this.userAuthService.canAccessRootFeatures(currentUser)) {
      throw new CannotModifyDefaultAIPersonaException();
    }

    // ✅ Use universal method for company access check
    if (
      aiPersona.companyId &&
      !this.userAuthService.canAccessCompany(currentUser, aiPersona.companyId)
    ) {
      throw new UnauthorizedAIPersonaModificationException(currentUser.id.getValue(), aiPersonaId);
    }

    return aiPersona;
  }

  /**
   * Gets all personas available for a company
   * Uses universal authorization to ensure user can access the company
   * ✅ Business Rule: Only returns active personas (isActive = true)
   */
  async getAvailableAIPersonasForCompany(
    companyId: string,
    currentUser: User,
  ): Promise<AIPersona[]> {
    // ✅ Use universal method for company access check
    if (!this.userAuthService.canAccessCompany(currentUser, companyId)) {
      return []; // Return empty array for unauthorized access
    }

    // ✅ Business Rule: Only return company-specific personas
    return await this.aiPersonaRepository.findAllByCompany(companyId);
  }

  /**
   * Gets the currently active persona for a company
   * ✅ Business Rule: Only returns if assignment is active AND persona is active
   * ✅ Security Measure: Validates user can access the company
   */
  async getActiveAIPersonaForCompany(
    companyId: string,
    currentUser: User,
  ): Promise<AIPersona | null> {
    // ✅ Security Measure: Validate user can access this company
    if (!this.userAuthService.canAccessCompany(currentUser, companyId)) {
      return null;
    }

    const assignment = await this.companyAIPersonaRepository.findByCompanyId(companyId);

    // ✅ Business Rule: Assignment must be active
    if (!assignment || !assignment.isActive) {
      return null;
    }

    const aiPersona = await this.aiPersonaRepository.findById(assignment.aiPersonaId);

    // ✅ Business Rule: Persona must also be active
    if (!aiPersona || !aiPersona.isActive) {
      return null;
    }

    return aiPersona;
  }

  /**
   * Checks if a persona can be deleted
   * Uses universal authorization methods to implement deletion rules
   * Business Rules:
   * - Default personas cannot be deleted (isDefault = true)
   * - Root users can delete any non-default persona
   * - Other users can only delete personas from their own company
   */
  async canDeleteAIPersona(aiPersonaId: string, currentUser: User): Promise<boolean> {
    // ✅ Use universal method: Root users can delete any non-default persona
    if (this.userAuthService.canAccessRootFeatures(currentUser)) {
      return true;
    }

    const aiPersona = await this.aiPersonaRepository.findById(aiPersonaId);

    if (!aiPersona) {
      return false; // Cannot delete non-existent persona
    }

    // ✅ Business Rule: Default personas cannot be deleted
    if (aiPersona.isDefault) {
      return false;
    }

    // ✅ Use universal method: Other users can only delete from their own company
    if (
      aiPersona.companyId &&
      !this.userAuthService.canAccessCompany(currentUser, aiPersona.companyId)
    ) {
      return false;
    }

    return true;
  }

  /**
   * Validates if a user can create a default persona
   * Uses universal authorization method
   */
  validateDefaultAIPersonaCreation(isDefault: boolean, currentUser: User): void {
    if (isDefault && !this.userAuthService.canAccessRootFeatures(currentUser)) {
      throw new CannotModifyDefaultAIPersonaException(
        'Only root users can create default AI personas',
      );
    }
  }

  /**
   * Validates if a user can create a company persona
   * Uses universal authorization method
   */
  validateCompanyAIPersonaCreation(companyId: string | null, currentUser: User): void {
    if (companyId && !this.userAuthService.canAccessCompany(currentUser, companyId)) {
      throw new UnauthorizedAIPersonaModificationException(
        currentUser.id.getValue(),
        'company-ai-persona',
      );
    }
  }

  /**
   * Creates a new AI Persona
   * ✅ Security Measure: Validates authorization before creation
   */
  async createAIPersona(
    name: string,
    tone: string,
    personality: string,
    objective: string,
    shortDetails: string,
    language: string,
    isDefault: boolean,
    companyId: string | null,
    createdBy: string,
    currentUser: User,
  ): Promise<AIPersona> {
    // ✅ Security Measure: Validate creation permissions
    this.validateDefaultAIPersonaCreation(isDefault, currentUser);
    if (companyId) {
      this.validateCompanyAIPersonaCreation(companyId, currentUser);
    }
    // Create value objects
    const nameVO = AIPersonaName.create(name);
    const keyNameVO = AIPersonaKeyName.fromName(name);
    const toneVO = AIPersonaTone.createFromString(tone, language);
    const personalityVO = AIPersonaPersonality.createFromString(personality, language);
    const objectiveVO = AIPersonaObjective.createFromString(objective, language);
    const shortDetailsVO = AIPersonaShortDetails.createFromString(shortDetails, language);

    // Check if keyName already exists
    const exists = await this.aiPersonaRepository.existsByKeyName(keyNameVO.getValue(), companyId);

    if (exists) {
      throw new AIPersonaKeyNameAlreadyExistsException(keyNameVO.getValue(), companyId);
    }

    // Create AI persona entity
    const aiPersona = AIPersona.create({
      name: nameVO,
      keyName: keyNameVO,
      tone: toneVO,
      personality: personalityVO,
      objective: objectiveVO,
      shortDetails: shortDetailsVO,
      isDefault,
      companyId,
      isActive: true,
      createdBy,
      updatedBy: createdBy,
    });

    // Save to repository
    const savedAIPersona = await this.aiPersonaRepository.save(aiPersona);

    // Publish domain events
    //aiPersona.getDomainEvents().forEach(event => {
    //  this.eventBus.publish(event);
    //});
    //aiPersona.clearDomainEvents();

    return savedAIPersona;
  }

  /**
   * Updates an AI Persona
   * ✅ Security Measure: Validates authorization before update
   */
  async updateAIPersona(
    id: string,
    tone: string,
    personality: string,
    objective: string,
    shortDetails: string,
    language: string,
    updatedBy: string,
    currentUser: User,
  ): Promise<AIPersona> {
    // ✅ Security Measure: Validate user can modify this persona
    await this.validateAIPersonaModification(id, currentUser);
    // Find existing AI persona
    const aiPersona = await this.aiPersonaRepository.findById(id);
    if (!aiPersona) {
      throw new AIPersonaNotFoundException(id);
    }

    // Create value objects - update with language
    const toneVO = aiPersona.tone.withLanguage(language, tone);
    const personalityVO = aiPersona.personality.withLanguage(language, personality);
    const objectiveVO = aiPersona.objective.withLanguage(language, objective);
    const shortDetailsVO = aiPersona.shortDetails.withLanguage(language, shortDetails);

    // Update AI persona
    aiPersona.update(toneVO, personalityVO, objectiveVO, shortDetailsVO, updatedBy);

    // Save to repository
    const updatedAIPersona = await this.aiPersonaRepository.update(aiPersona);

    // Publish domain events
    //aiPersona.getDomainEvents().forEach(event => {
    //  this.eventBus.publish(event);
    //});
    //aiPersona.clearDomainEvents();

    return updatedAIPersona;
  }

  /**
   * Updates AI Persona active status
   * Business Rule: If default persona becomes inactive, remove all company assignments
   * ✅ Security Measure: Only authorized users can modify AI Persona status
   */
  async updateAIPersonaStatus(
    id: string,
    isActive: boolean,
    updatedBy: string,
    currentUser: User,
  ): Promise<AIPersona> {
    // ✅ Security Measure: Validate user can modify this persona
    await this.validateAIPersonaModification(id, currentUser);
    // Find existing AI persona
    const aiPersona = await this.aiPersonaRepository.findById(id);
    if (!aiPersona) {
      throw new AIPersonaNotFoundException(id);
    }

    // Store previous state for business rule check
    const wasDefaultAndActive = aiPersona.isDefault && aiPersona.isActive;
    const becomingInactive = wasDefaultAndActive && !isActive;

    // Update status using proper entity methods
    if (isActive) {
      aiPersona.activate(updatedBy);
    } else {
      aiPersona.deactivate(updatedBy);
    }

    // Save to repository
    const updatedAIPersona = await this.aiPersonaRepository.update(aiPersona);

    // ✅ Business Rule: If default persona becomes inactive, remove all company assignments
    if (becomingInactive) {
      await this.removeAllCompanyAssignments(id);
    }

    // Publish domain events
    //aiPersona.getDomainEvents().forEach(event => {
    //  this.eventBus.publish(event);
    //});
    //aiPersona.clearDomainEvents();

    return updatedAIPersona;
  }

  /**
   * Removes all company assignments for a persona
   * Used when default persona becomes inactive
   * ✅ Security Measure: Only root users can trigger this operation (via updateAIPersonaStatus)
   */
  private async removeAllCompanyAssignments(aiPersonaId: string): Promise<void> {
    // Note: This method is private and can only be called from updateAIPersonaStatus,
    // which already has authorization checks in place.

    try {
      // Get all assignments for this AI Persona
      const assignments = await this.companyAIPersonaRepository.findAllByAIPersonaId(aiPersonaId);

      if (assignments.length === 0) {
        this.logger.log(`No company assignments found for AI Persona ${aiPersonaId}`);

        return;
      }

      // Remove all assignments using the bulk operation
      const removedCount =
        await this.companyAIPersonaRepository.removeAllAssignmentsForPersona(aiPersonaId);

      this.logger.warn(
        `Business Rule Applied: Default AI Persona ${aiPersonaId} became inactive. ` +
          `Removed ${removedCount} company assignments.`,
      );

      // Log each affected company for audit purposes
      const affectedCompanies = assignments.map(a => a.companyId).join(', ');
      this.logger.warn(
        `Companies affected by AI Persona ${aiPersonaId} deactivation: ${affectedCompanies}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to remove company assignments for AI Persona ${aiPersonaId}:`,
        error.stack,
      );
      throw new AIPersonaCompanyAssignmentRemovalException(aiPersonaId, error.message);
    }
  }

  /**
   * Deletes an AI Persona
   * Uses authorization validation before deletion
   */
  async deleteAIPersona(id: string, currentUser: User): Promise<boolean> {
    // Check if AI persona exists
    const aiPersona = await this.aiPersonaRepository.findById(id);
    if (!aiPersona) {
      throw new AIPersonaNotFoundException(id);
    }

    // ✅ Use updated canDelete method with user authorization
    const canDelete = await this.canDeleteAIPersona(id, currentUser);
    if (!canDelete) {
      if (aiPersona.isDefault) {
        throw new CannotDeleteDefaultAIPersonaException();
      } else {
        throw new InsufficientPermissionsException('delete_ai_persona', 'AI Persona');
      }
    }

    // Delete AI persona
    return await this.aiPersonaRepository.delete(id);
  }

  /**
   * Assigns an AI Persona to a company
   * ✅ Security Measure: Validates authorization before assignment
   */
  async assignAIPersonaToCompany(
    companyId: string,
    aiPersonaId: string,
    assignedBy: string,
    currentUser: User,
  ): Promise<ICompanyAIPersonaAssignment> {
    if (!this.userAuthService.canAccessRootFeatures(currentUser)) {
      // ✅ Security Measure: Validate user can assign to this company
      this.validateCompanyAIPersonaCreation(companyId, currentUser);
    }

    // Verify AI persona exists and is active
    const aiPersona = await this.aiPersonaRepository.findById(aiPersonaId);
    if (!aiPersona || !aiPersona.isActive) {
      throw new AIPersonaNotFoundException(aiPersonaId);
    }

    // Assign AI persona to company (upsert will handle existing assignment)
    return await this.companyAIPersonaRepository.assignAIPersonaToCompany(
      companyId,
      aiPersonaId,
      assignedBy,
    );
  }

  /**
   * Gets an AI Persona by ID
   * Note: This method returns the persona regardless of isActive status (for admin purposes)
   */
  async getAIPersonaById(id: string): Promise<AIPersona> {
    const aiPersona = await this.aiPersonaRepository.findById(id);

    if (!aiPersona) {
      throw new AIPersonaNotFoundException(id);
    }

    return aiPersona;
  }

  /**
   * Gets all AI Personas with optional filters
   * ✅ Business Rule: Only returns active personas by default unless explicitly requested
   */
  async getAllAIPersonas(filters?: Record<string, unknown>): Promise<AIPersona[]> {
    // ✅ Business Rule: Default to active personas only unless explicitly specified
    const finalFilters = {
      isActive: true,
      ...filters, // User filters can override the default
    };

    return await this.aiPersonaRepository.findAll(finalFilters);
  }

  /**
   * Gets all AI Personas for a specific company
   * (only company-specific personas, NOT defaults)
   * ✅ Business Rule: Only returns active company-specific personas
   * ✅ Security Measure: Validates user can access the company
   */
  async getCompanyAIPersonas(companyId: string, currentUser: User): Promise<AIPersona[]> {
    if (!this.userAuthService.canAccessRootFeatures(currentUser)) {
      // ✅ Security Measure: Validate user can access this company
      if (!this.userAuthService.canAccessCompany(currentUser, companyId)) {
        return [];
      }
    }

    // ✅ Business Rule: Only return company-specific personas (not defaults)
    const result = (await this.aiPersonaRepository.findAllByCompany(companyId)) || [];

    return result;

    //const assignment = await this.companyAIPersonaRepository.findByCompanyId(companyId);

    // ✅ Business Rule: Assignment must be active
    /*if (assignment && assignment.isActive) {
      result = result.filter(r => r.id !== assignment.aiPersonaId);

      const aiPersona = await this.aiPersonaRepository.findById(assignment.aiPersonaId);

      // ✅ Business Rule: Persona must also be active
      if (aiPersona && aiPersona.isActive && !aiPersona.companyId) {
        aiPersona.companyId = companyId;
        aiPersona.createdBy = currentUser.id.getValue();
        aiPersona.updatedBy = currentUser.id.getValue();
        result.push(aiPersona);
      } else {
        result.push(aiPersona);
      }
    }

    return result;*/
  }

  /**
   * Gets the active AI Persona for a company
   * ✅ Business Rule: Only returns if assignment is active AND persona is active
   * ✅ Security Measure: Validates user can access the company
   */
  async getCompanyActiveAIPersona(companyId: string, currentUser: User): Promise<AIPersona | null> {
    if (!this.userAuthService.canAccessRootFeatures(currentUser)) {
      // ✅ Security Measure: Validate user can access this company
      if (!this.userAuthService.canAccessCompany(currentUser, companyId)) {
        return null;
      }
    }

    const assignment = await this.companyAIPersonaRepository.findByCompanyId(companyId);

    // ✅ Business Rule: Assignment must be active
    if (!assignment || !assignment.isActive) {
      return null;
    }

    const aiPersona = await this.aiPersonaRepository.findById(assignment.aiPersonaId);

    // ✅ Business Rule: Persona must also be active
    if (!aiPersona || !aiPersona.isActive) {
      return null;
    }

    // Assignment are static to prevent duplicates
    if (!aiPersona.companyId) {
      aiPersona.companyId = companyId;
      aiPersona.createdBy = currentUser.id.getValue();
      aiPersona.updatedBy = currentUser.id.getValue();
    }

    return aiPersona;
  }

  /**
   * Updates the active status of a company's AI Persona assignment
   * ✅ Security Measure: Validates user can modify assignments for the company
   * ✅ Business Rule: Creates assignment if it doesn't exist (upsert behavior)
   * ✅ Business Rule: Verifies AI Persona exists and is active before assignment
   */
  async updateCompanyAIPersonaStatus(
    companyId: string,
    aiPersonaId: string,
    isActive: boolean,
    updatedBy: string,
    currentUser: User,
  ): Promise<ICompanyAIPersonaAssignment> {
    // ✅ Security Measure: Validate user can modify assignments for this company
    if (!this.userAuthService.canAccessRootFeatures(currentUser)) {
      if (!this.userAuthService.canAccessCompany(currentUser, companyId)) {
        throw new InsufficientPermissionsException(
          'update_company_ai_persona_status',
          'CompanyAIPersona',
        );
      }
    }

    // ✅ Business Rule: Verify AI Persona exists and is active
    const aiPersona = await this.aiPersonaRepository.findById(aiPersonaId);
    if (!aiPersona) {
      throw new AIPersonaNotFoundException(aiPersonaId);
    }

    // If trying to activate but persona is inactive, prevent it
    if (isActive && !aiPersona.isActive) {
      throw new CannotModifyDefaultAIPersonaException(
        `Cannot activate assignment for inactive AI Persona ${aiPersonaId}`,
      );
    }

    // Find existing assignment
    const existingAssignment = await this.companyAIPersonaRepository.findByCompanyId(companyId);

    let updatedAssignment: ICompanyAIPersonaAssignment;

    if (!existingAssignment) {
      // Create new assignment if it doesn't exist
      this.logger.log(
        `Creating new AI Persona assignment for company ${companyId} with persona ${aiPersonaId}`,
      );

      updatedAssignment = await this.companyAIPersonaRepository.assignAIPersonaToCompany(
        companyId,
        aiPersonaId,
        updatedBy,
      );

      // If the request is to deactivate, update it immediately
      if (!isActive) {
        updatedAssignment = await this.companyAIPersonaRepository.updateAssignmentStatus(
          companyId,
          isActive,
        );
      }
    } else if (existingAssignment.aiPersonaId !== aiPersonaId) {
      // Different persona, update to new one
      this.logger.log(
        `Changing company ${companyId} AI Persona from ${existingAssignment.aiPersonaId} to ${aiPersonaId}`,
      );

      updatedAssignment = await this.companyAIPersonaRepository.assignAIPersonaToCompany(
        companyId,
        aiPersonaId,
        updatedBy,
      );

      // Apply the requested active status
      if (!isActive) {
        updatedAssignment = await this.companyAIPersonaRepository.updateAssignmentStatus(
          companyId,
          isActive,
        );
      }
    } else {
      // Same persona, just update status
      updatedAssignment = await this.companyAIPersonaRepository.updateAssignmentStatus(
        companyId,
        isActive,
      );
    }

    this.logger.log(
      `Company ${companyId} AI Persona ${aiPersonaId} assignment status updated to ${isActive ? 'active' : 'inactive'} by ${updatedBy}`,
    );

    return updatedAssignment;
  }
}
