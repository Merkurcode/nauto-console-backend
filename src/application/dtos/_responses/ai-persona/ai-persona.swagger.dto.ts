import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AIPersonaSwaggerDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'AI Persona unique identifier',
  })
  id: string;

  @ApiProperty({
    example: 'Friendly',
    description: 'AI Persona name',
  })
  name: string;

  @ApiProperty({
    example: 'friendly',
    description: 'AI Persona key name (normalized)',
  })
  keyName: string;

  @ApiProperty({
    example: { 'es-MX': 'cálido y acogedor', 'en-US': 'warm and welcoming' },
    description: 'AI Persona tone (max 3 words per language)',
  })
  tone: Record<string, string>;

  @ApiProperty({
    example: { 'es-MX': 'útil alegre profesional', 'en-US': 'helpful cheerful professional' },
    description: 'AI Persona personality (max 3 words per language)',
  })
  personality: Record<string, string>;

  @ApiProperty({
    example: {
      'es-MX':
        'Proporcionar excelente servicio al cliente con atención personalizada y soluciones efectivas',
      'en-US':
        'Provide excellent customer service with personalized attention and effective solutions',
    },
    description: 'AI Persona objective (max 100 characters per language)',
  })
  objective: Record<string, string>;

  @ApiProperty({
    example: {
      'es-MX': 'Breve descripción de esta persona IA',
      'en-US': 'Brief description of this AI persona',
    },
    description: 'AI Persona short details (max 75 characters per language)',
  })
  shortDetails: Record<string, string>;

  @ApiProperty({
    example: false,
    description: 'Whether this is a default system-wide AI persona',
  })
  isDefault: boolean;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Company ID (null for default AI personas)',
  })
  companyId: string | null;

  @ApiProperty({
    example: true,
    description: 'Whether the AI persona is active',
  })
  isActive: boolean;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID of user who created this AI persona',
  })
  createdBy: string | null;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID of user who last updated this AI persona',
  })
  updatedBy: string | null;

  @ApiProperty({
    example: '2023-01-01T00:00:00.000Z',
    description: 'AI Persona creation date',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2023-01-01T00:00:00.000Z',
    description: 'AI Persona last update date',
  })
  updatedAt: Date;
}
