import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AIAssistantFeatureResponse {
  @ApiProperty({
    description: 'Unique identifier of the feature',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  id: string;

  @ApiProperty({
    description: 'Internal key name of the feature',
    example: 'BRAND_EXPERT',
  })
  keyName: string;

  @ApiProperty({
    description: 'Display title of the feature',
    example: 'Brand Expert',
  })
  title: string;

  @ApiProperty({
    description: 'Detailed description of the feature',
    example: 'Provides expert knowledge about brand guidelines and marketing strategies',
  })
  description: string;

  @ApiPropertyOptional({
    description: 'Whether the feature is enabled for the company',
    example: true,
  })
  enabled?: boolean;
}

export class AIAssistantResponse {
  @ApiProperty({
    description: 'Unique identifier of the AI assistant',
    example: 'b2c3d4e5-f6g7-8901-bcde-f23456789012',
  })
  id: string;

  @ApiProperty({
    description: 'Name of the AI assistant',
    example: 'Lily',
  })
  name: string;

  @ApiProperty({
    description: 'Area of expertise',
    example: 'Marketing & Branding',
  })
  area: string;

  @ApiProperty({
    description: 'Description of the AI assistant capabilities',
    example:
      'AI assistant specialized in marketing strategies, brand management, and customer engagement tactics',
  })
  description: string;

  @ApiPropertyOptional({
    description: 'Whether the assistant is available in the system',
    example: true,
  })
  available?: boolean;

  @ApiPropertyOptional({
    description: 'Whether the assistant is enabled for the company',
    example: true,
  })
  enabled?: boolean;

  @ApiProperty({
    description: 'List of features available for this assistant',
    type: [AIAssistantFeatureResponse],
    example: [
      {
        id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        keyName: 'BRAND_EXPERT',
        title: 'Brand Expert',
        description: 'Provides expert knowledge about brand guidelines',
        enabled: true,
      },
      {
        id: 'g58bd21c-69dd-5483-b678-1f13c3d4e580',
        keyName: 'MARKETING_ASSISTANT',
        title: 'Marketing Assistant',
        description: 'Helps with marketing campaign planning',
        enabled: false,
      },
    ],
  })
  features: AIAssistantFeatureResponse[];
}

export class CompanyAIAssistantResponse {
  @ApiProperty({
    description: 'Unique identifier of the company-assistant assignment',
    example: 'c3d4e5f6-g7h8-9012-cdef-g34567890123',
  })
  id: string;

  @ApiProperty({
    description: 'UUID of the AI assistant',
    example: 'b2c3d4e5-f6g7-8901-bcde-f23456789012',
  })
  assistantId: string;

  @ApiProperty({
    description: 'Whether the assistant is enabled for this company',
    example: true,
  })
  enabled: boolean;

  @ApiProperty({
    description: 'Full details of the AI assistant',
    type: AIAssistantResponse,
  })
  assistant: AIAssistantResponse;
}

// Type aliases for backward compatibility
export type IAIAssistantFeatureResponse = AIAssistantFeatureResponse;
export type IAIAssistantResponse = AIAssistantResponse;
export type ICompanyAIAssistantResponse = CompanyAIAssistantResponse;
