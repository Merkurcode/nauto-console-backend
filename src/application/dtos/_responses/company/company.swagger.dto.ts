import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IndustrySectorEnum, IndustryOperationChannelEnum } from '@shared/constants/enums';

export class AddressSwaggerDto {
  @ApiProperty({
    example: 'United States',
    description: 'Country name',
  })
  country: string;

  @ApiProperty({
    example: 'California',
    description: 'State name',
  })
  state: string;

  @ApiProperty({
    example: 'Los Angeles',
    description: 'City name',
  })
  city: string;

  @ApiProperty({
    example: 'Main Street',
    description: 'Street name',
  })
  street: string;

  @ApiProperty({
    example: '123',
    description: 'Exterior number',
  })
  exteriorNumber: string;

  @ApiPropertyOptional({
    example: 'A',
    description: 'Interior number',
  })
  interiorNumber?: string;

  @ApiProperty({
    example: '90210',
    description: 'Postal code',
  })
  postalCode: string;

  @ApiProperty({
    example: 'Main Street 123 A, Los Angeles, California, United States 90210',
    description: 'Full formatted address',
  })
  fullAddress: string;

  @ApiPropertyOptional({
    example: 'https://maps.google.com/?q=123+Main+Street,Los+Angeles,CA',
    description: 'Google Maps URL for the address',
  })
  googleMapsUrl?: string;
}

export class AssistantFeatureSwaggerDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Feature unique identifier',
  })
  id: string;

  @ApiProperty({
    example: 'lead_qualification',
    description: 'Feature key name',
  })
  keyName: string;

  @ApiProperty({
    example: { en: 'Lead Qualification', es: 'Calificación de Leads' },
    description: 'Feature title in different languages',
  })
  title: Record<string, string>;

  @ApiProperty({
    example: { en: 'Qualify leads automatically', es: 'Califica leads automáticamente' },
    description: 'Feature description in different languages',
  })
  description: Record<string, string>;

  @ApiProperty({
    example: true,
    description: 'Whether the feature is enabled for this company',
  })
  enabled: boolean;
}

export class AssistantSwaggerDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Assistant unique identifier',
  })
  id: string;

  @ApiProperty({
    example: 'Lily',
    description: 'Assistant name',
  })
  name: string;

  @ApiProperty({
    example: 'BRAND_EXPERT',
    description: 'Assistant area of expertise',
  })
  area: string;

  @ApiProperty({
    example: { en: 'Brand expertise assistant', es: 'Asistente experto en marca' },
    description: 'Assistant description in different languages',
  })
  description: Record<string, string>;

  @ApiProperty({
    example: true,
    description: 'Whether the assistant is enabled for this company',
  })
  enabled: boolean;

  @ApiProperty({
    type: [AssistantFeatureSwaggerDto],
    description: 'Features available for this assistant',
  })
  features: AssistantFeatureSwaggerDto[];
}

export class WeeklyScheduleSummarySwaggerDto {
  @ApiProperty({
    example: 5,
    description: 'Number of days with active schedules',
  })
  totalActiveDays: number;

  @ApiProperty({
    example: 40.5,
    description: 'Total scheduled hours per week',
  })
  totalScheduledHours: number;

  @ApiProperty({
    example: 8.1,
    description: 'Average hours per day',
  })
  averageHoursPerDay: number;

  @ApiProperty({
    example: [0, 6],
    description: 'Days of week without schedule (0=Sunday, 6=Saturday)',
    type: [Number],
  })
  daysWithoutSchedule: number[];
}

export class CompanyScheduleSwaggerDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Schedule unique identifier',
  })
  id: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Company identifier',
  })
  companyId: string;

  @ApiProperty({
    example: 1,
    description: 'Day of week (0=Sunday, 1=Monday, ..., 6=Saturday)',
  })
  dayOfWeek: number;

  @ApiProperty({
    example: 'Monday',
    description: 'Day of week name',
  })
  dayOfWeekName: string;

  @ApiProperty({
    example: '2023-01-01T09:00:00.000Z',
    description: 'Schedule start time',
  })
  startTime: Date;

  @ApiProperty({
    example: '2023-01-01T17:00:00.000Z',
    description: 'Schedule end time',
  })
  endTime: Date;

  @ApiProperty({
    example: 480,
    description: 'Duration in minutes',
  })
  durationMinutes: number;

  @ApiProperty({
    example: true,
    description: 'Whether the schedule is active',
  })
  isActive: boolean;

  @ApiProperty({
    example: '2023-01-01T00:00:00.000Z',
    description: 'Schedule creation date',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2023-01-01T00:00:00.000Z',
    description: 'Schedule last update date',
  })
  updatedAt: Date;
}

export class CompanyWeeklyScheduleSwaggerDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Company identifier',
  })
  companyId: string;

  @ApiProperty({
    type: [CompanyScheduleSwaggerDto],
    description: 'Weekly schedule entries',
  })
  weeklySchedule: CompanyScheduleSwaggerDto[];

  @ApiProperty({
    type: WeeklyScheduleSummarySwaggerDto,
    description: 'Weekly schedule summary statistics',
  })
  summary: WeeklyScheduleSummarySwaggerDto;
}

export class AIPersonaSwaggerDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'AI Persona unique identifier',
  })
  id: string;

  @ApiProperty({
    example: 'Professional Assistant',
    description: 'AI Persona name',
  })
  name: string;

  @ApiProperty({
    example: { en: 'Professional tone', es: 'Tono profesional' },
    description: 'AI Persona tone in different languages',
  })
  tone: Record<string, string>;

  @ApiProperty({
    example: { en: 'A professional and helpful assistant', es: 'Un asistente profesional y útil' },
    description: 'AI Persona personality description in different languages',
  })
  personality: Record<string, string>;

  @ApiProperty({
    example: true,
    description: 'Whether the AI Persona is active',
  })
  isActive: boolean;

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

export class CompanySwaggerDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Company unique identifier (also serves as Tenant ID for multi-tenant operations)',
  })
  id: string;

  @ApiProperty({
    example: 'Acme Corporation',
    description: 'Company name',
  })
  name: string;

  @ApiProperty({
    example: 'A leading technology company focused on innovative solutions',
    description: 'Company description',
  })
  description: string;

  @ApiProperty({
    example: 'acme-corp.com',
    description: 'Company host domain',
  })
  host: string;

  @ApiProperty({
    type: AddressSwaggerDto,
    description: 'Company address',
  })
  address: AddressSwaggerDto;

  @ApiProperty({
    example: true,
    description: 'Whether the company is active',
  })
  isActive: boolean;

  @ApiProperty({
    example: 'America/Mexico_City',
    description: 'Company timezone',
  })
  timezone: string;

  @ApiProperty({
    example: 'MXN',
    description: 'Company currency',
  })
  currency: string;

  @ApiProperty({
    example: 'es-MX',
    description: 'Company language',
  })
  language: string;

  @ApiPropertyOptional({
    example: 'https://example.com/logo.png',
    description: 'Company logo URL',
  })
  logoUrl?: string;

  @ApiPropertyOptional({
    example: 'https://example.com',
    description: 'Company website URL',
  })
  websiteUrl?: string;

  @ApiPropertyOptional({
    example: 'https://example.com/privacy',
    description: 'Company privacy policy URL',
  })
  privacyPolicyUrl?: string;

  @ApiProperty({
    enum: IndustrySectorEnum,
    example: IndustrySectorEnum.OTHER,
    description: 'Industry sector of the company',
  })
  industrySector: IndustrySectorEnum;

  @ApiProperty({
    enum: IndustryOperationChannelEnum,
    example: IndustryOperationChannelEnum.MIXED,
    description: 'Industry operation channel of the company',
  })
  industryOperationChannel: IndustryOperationChannelEnum;

  @ApiPropertyOptional({
    type: () => CompanySwaggerDto,
    description: 'Parent company information',
  })
  parentCompany?: CompanySwaggerDto;

  @ApiPropertyOptional({
    type: [CompanySwaggerDto],
    description: 'Subsidiary companies',
  })
  subsidiaries?: CompanySwaggerDto[];

  @ApiPropertyOptional({
    example: 0,
    description: 'Level in company hierarchy (0 = root company, 1 = first level subsidiary, etc.)',
  })
  hierarchyLevel?: number;

  @ApiPropertyOptional({
    type: [AssistantSwaggerDto],
    description: 'AI assistants assigned to the company with their enabled features',
  })
  assistants?: AssistantSwaggerDto[];

  @ApiPropertyOptional({
    type: CompanyWeeklyScheduleSwaggerDto,
    description: 'Company weekly operating schedule with summary statistics',
  })
  weeklySchedule?: CompanyWeeklyScheduleSwaggerDto;

  @ApiPropertyOptional({
    type: AIPersonaSwaggerDto,
    description: 'Active AI persona configuration for the company',
  })
  activeAIPersona?: AIPersonaSwaggerDto;

  @ApiProperty({
    example: '2023-01-01T00:00:00.000Z',
    description: 'Company creation date',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2023-01-01T00:00:00.000Z',
    description: 'Company last update date',
  })
  updatedAt: Date;
}
