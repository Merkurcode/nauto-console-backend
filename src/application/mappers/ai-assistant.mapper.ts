import { Injectable } from '@nestjs/common';
import { AIAssistant } from '@core/entities/ai-assistant.entity';
import { CompanyAIAssistant } from '@core/entities/company-ai-assistant.entity';
import {
  IAIAssistantResponse,
  ICompanyAIAssistantResponse,
} from '@application/dtos/_responses/ai-assistant/ai-assistant.response';

@Injectable()
export class AIAssistantMapper {
  toResponse(assistant: AIAssistant, lang: string = 'en-US'): IAIAssistantResponse {
    return {
      id: assistant.id,
      name: assistant.name,
      area: assistant.area,
      description: assistant.getLocalizedDescription(lang),
      available: assistant.available,
      features: assistant.features.map(feature => {
        const localized = assistant.getLocalizedFeature(feature, lang);

        return {
          id: feature.id,
          keyName: feature.keyName,
          title: localized.title,
          description: localized.description,
        };
      }),
    };
  }

  toCompanyAssistantResponse(
    assignment: CompanyAIAssistant,
    assistant: AIAssistant,
    lang: string = 'en-US',
  ): ICompanyAIAssistantResponse {
    const assistantResponse = this.toResponse(assistant, lang);

    // Map enabled features
    assistantResponse.features = assistantResponse.features.map(feature => {
      const assignmentFeature = assignment.features.find(f => f.featureId === feature.id);

      return {
        ...feature,
        enabled: assignmentFeature?.enabled || false,
      };
    });

    return {
      id: assignment.id,
      assistantId: assignment.aiAssistantId,
      enabled: assignment.enabled,
      assistant: {
        ...assistantResponse,
        enabled: assignment.enabled,
      },
    };
  }

  toResponseList(assistants: AIAssistant[], lang: string = 'en-US'): IAIAssistantResponse[] {
    return assistants.map(assistant => this.toResponse(assistant, lang));
  }

  toCompanyAssistantResponseList(
    assignments: CompanyAIAssistant[],
    assistants: AIAssistant[],
    lang: string = 'en-US',
  ): ICompanyAIAssistantResponse[] {
    return assignments.map(assignment => {
      const assistant = assistants.find(a => a.id === assignment.aiAssistantId);
      if (!assistant) {
        throw new Error(`Assistant with id ${assignment.aiAssistantId} not found`);
      }

      return this.toCompanyAssistantResponse(assignment, assistant, lang);
    });
  }
}
