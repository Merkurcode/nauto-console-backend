import { IsOptional, IsString, IsBoolean, IsObject, IsUrl, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateCompanyEventDto {
  @ApiPropertyOptional({
    description: 'Multi-language event title',
    example: { 'en-US': 'Updated Online Meeting', 'es-MX': 'Reunión en Línea Actualizada' },
  })
  @IsOptional()
  @IsObject()
  title?: Record<string, string>;

  @ApiPropertyOptional({
    description: 'Multi-language event description',
    example: {
      'en-US': 'Updated virtual meeting session',
      'es-MX': 'Sesión de reunión virtual actualizada',
    },
  })
  @IsOptional()
  @IsObject()
  description?: Record<string, string>;

  @ApiPropertyOptional({
    description: 'URL to event icon image',
    example: 'https://example.com/icons/updated-meeting.png',
  })
  @IsOptional()
  @IsString()
  @IsUrl()
  iconUrl?: string;

  @ApiPropertyOptional({
    description: 'Hex color code for the event',
    example: '#00FF33',
  })
  @IsOptional()
  @IsString()
  @Matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, {
    message: 'Color must be a valid hex color code (e.g., #FF5733)',
  })
  color?: string;

  @ApiPropertyOptional({
    description: 'Whether the event can be conducted online',
  })
  @IsOptional()
  @IsBoolean()
  isOnline?: boolean;

  @ApiPropertyOptional({
    description: 'Whether the event requires physical presence',
  })
  @IsOptional()
  @IsBoolean()
  isPhysical?: boolean;

  @ApiPropertyOptional({
    description: 'Whether the event is an appointment type',
  })
  @IsOptional()
  @IsBoolean()
  isAppointment?: boolean;

  @ApiPropertyOptional({
    description: 'Whether the event is active',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
