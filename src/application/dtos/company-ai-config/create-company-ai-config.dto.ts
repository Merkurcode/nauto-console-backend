import { IsOptional, IsString, IsNumber, Length, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TrimAndValidateLength } from '@shared/decorators/trim-and-validate-length.decorator';
import { ICompanyConfigAI } from '@core/interfaces/company-config-ai.interface';

/**
 * DTO for creating company AI configuration
 * Following Clean Architecture: Application layer DTOs for input validation
 */
export class CreateCompanyAIConfigDto implements ICompanyConfigAI {
  @ApiProperty({
    description: 'Welcome message displayed to users',
    maxLength: 3000,
    required: false,
    example: 'Welcome! How can I assist you today?',
  })
  @IsOptional()
  @IsString()
  @TrimAndValidateLength({ min: 1, max: 3000 })
  @Length(1, 3000, { message: 'Welcome message must be between 1 and 3000 characters' })
  welcomeMessage?: string;

  @ApiProperty({
    description: 'AI model temperature setting (0.0 to 1.0) - Controls randomness/creativity',
    minimum: 0.0,
    maximum: 1.0,
    required: false,
    example: 0.7,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Temperature must be a number' })
  @Min(0.0, { message: 'Temperature must be at least 0.0' })
  @Max(1.0, { message: 'Temperature must be at most 1.0' })
  temperature?: number;

  @ApiProperty({
    description: 'Instructions for AI response behavior',
    maxLength: 3000,
    required: false,
    example: 'Respond in a professional and helpful manner. Always ask clarifying questions.',
  })
  @IsOptional()
  @IsString()
  @TrimAndValidateLength({ min: 1, max: 3000 })
  @Length(1, 3000, { message: 'Response instructions must be between 1 and 3000 characters' })
  responseInstructions?: string;

  @ApiProperty({
    description: 'Instructions for discovering client needs',
    maxLength: 3000,
    required: false,
    example:
      'Ask targeted questions to understand the client specific requirements and pain points.',
  })
  @IsOptional()
  @IsString()
  @TrimAndValidateLength({ min: 1, max: 3000 })
  @Length(1, 3000, {
    message: 'Client discovery instructions must be between 1 and 3000 characters',
  })
  clientDiscoveryInstructions?: string;
}
