import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CompanyEventResponseDto {
  @ApiProperty({
    description: 'Event unique identifier',
    example: 'reunion_en_linea',
  })
  id: string;

  @ApiProperty({
    description: 'Standardized event name',
    example: 'reunion_en_linea',
  })
  eventName: string;

  @ApiProperty({
    description: 'Multi-language event title',
    example: { 'en-US': 'Online Meeting', 'es-MX': 'Reunión en Línea' },
  })
  title: Record<string, string>;

  @ApiProperty({
    description: 'Multi-language event description',
    example: { 'en-US': 'Virtual meeting session', 'es-MX': 'Sesión de reunión virtual' },
  })
  description: Record<string, string>;

  @ApiPropertyOptional({
    description: 'URL to event icon image',
    example: 'https://example.com/icons/meeting.png',
  })
  iconUrl?: string;

  @ApiPropertyOptional({
    description: 'Hex color code for the event',
    example: '#FF5733',
  })
  color?: string;

  @ApiProperty({
    description: 'Whether the event is active',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Whether the event can be conducted online',
    example: true,
  })
  isOnline: boolean;

  @ApiProperty({
    description: 'Whether the event requires physical presence',
    example: false,
  })
  isPhysical: boolean;

  @ApiProperty({
    description: 'Whether the event is an appointment type',
    example: true,
  })
  isAppointment: boolean;

  @ApiProperty({
    description: 'Company ID that owns this event',
    example: 'comp-123-456-789',
  })
  companyId: string;

  @ApiProperty({
    description: 'Event creation timestamp',
    example: '2024-01-15T10:30:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Event last update timestamp',
    example: '2024-01-15T14:20:00Z',
  })
  updatedAt: Date;
}

export class CompanyEventsListResponseDto {
  @ApiProperty({
    description: 'List of company events',
    type: [CompanyEventResponseDto],
  })
  events: CompanyEventResponseDto[];

  @ApiProperty({
    description: 'Total number of events',
    example: 25,
  })
  total: number;

  @ApiProperty({
    description: 'Pagination information',
    example: {
      limit: 10,
      offset: 0,
      hasMore: true,
    },
  })
  page: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}
