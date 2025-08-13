import { AIPersona } from '@core/entities/ai-persona.entity';
import { IAIPersonaResponse } from '@application/dtos/_responses/ai-persona/ai-persona.response.interface';
import { IAIPersonaAssignmentResponse } from '@application/dtos/_responses/ai-persona/ai-persona-assignment.response.interface';
import { ICompanyAIPersonaAssignment } from '@core/repositories/company-ai-persona.repository.interface';

export class AIPersonaMapper {
  public static toResponse(aiPersona: AIPersona): IAIPersonaResponse {
    return {
      id: aiPersona.id,
      name: aiPersona.name.getValue(),
      keyName: aiPersona.keyName.getValue(),
      tone: aiPersona.tone.getValue(),
      personality: aiPersona.personality.getValue(),
      objective: aiPersona.objective.getValue(),
      shortDetails: aiPersona.shortDetails.getValue(),
      isDefault: aiPersona.isDefault,
      companyId: aiPersona.companyId,
      isActive: aiPersona.isActive,
      createdBy: aiPersona.createdBy,
      updatedBy: aiPersona.updatedBy,
      createdAt: aiPersona.createdAt,
      updatedAt: aiPersona.updatedAt,
    };
  }

  public static toResponseArray(aiPersonas: AIPersona[]): IAIPersonaResponse[] {
    return aiPersonas.map(aiPersona => this.toResponse(aiPersona));
  }

  public static toAssignmentResponse(
    assignment: ICompanyAIPersonaAssignment,
  ): IAIPersonaAssignmentResponse {
    return {
      id: assignment.id,
      companyId: assignment.companyId,
      aiPersonaId: assignment.aiPersonaId,
      isActive: assignment.isActive,
      assignedAt: assignment.assignedAt,
      assignedBy: assignment.assignedBy,
    };
  }
}
