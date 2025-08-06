import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsBoolean,
  IsObject,
  IsUrl,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCompanyEventDto {
  @ApiProperty({
    description: 'Multi-language event title',
    example: { 'en-US': 'Online Meeting', 'es-MX': 'Reunión en Línea' },
  })
  @IsObject()
  @IsNotEmpty()
  title: Record<string, string>;

  @ApiProperty({
    description: 'Multi-language event description',
    example: { 'en-US': 'Virtual meeting session', 'es-MX': 'Sesión de reunión virtual' },
  })
  @IsObject()
  @IsNotEmpty()
  description: Record<string, string>;

  @ApiProperty({
    description: 'Event name (will be standardized to lowercase with underscores)',
    example: 'reunion en linea',
  })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  eventName: string;

  @ApiPropertyOptional({
    description: 'URL to event icon image',
    example: 'https://example.com/icons/meeting.png',
  })
  @IsOptional()
  @IsString()
  @IsUrl()
  iconUrl?: string;

  @ApiPropertyOptional({
    description: 'Hex color code for the event',
    example: '#FF5733',
  })
  @IsOptional()
  @IsString()
  @Matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, {
    message: 'Color must be a valid hex color code (e.g., #FF5733)',
  })
  color?: string;

  @ApiPropertyOptional({
    description: 'Whether the event can be conducted online',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isOnline?: boolean = false;

  @ApiPropertyOptional({
    description: 'Whether the event requires physical presence',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isPhysical?: boolean = false;

  @ApiPropertyOptional({
    description: 'Whether the event is an appointment type',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isAppointment?: boolean = false;

  @ApiPropertyOptional({
    description: 'Whether the event is active',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}
