export interface IAIAssistantFeatureResponse {
  id: string;
  keyName: string;
  title: string;
  description: string;
  enabled?: boolean;
}

export interface IAIAssistantResponse {
  id: string;
  name: string;
  area: string;
  description: string;
  available?: boolean;
  enabled?: boolean;
  features: IAIAssistantFeatureResponse[];
}

export interface ICompanyAIAssistantResponse {
  id: string;
  assistantId: string;
  enabled: boolean;
  assistant: IAIAssistantResponse;
}

// Type aliases for backward compatibility
export type AIAssistantFeatureResponse = IAIAssistantFeatureResponse;
export type AIAssistantResponse = IAIAssistantResponse;
export type CompanyAIAssistantResponse = ICompanyAIAssistantResponse;
