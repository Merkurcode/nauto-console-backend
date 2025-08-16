import { IsInt, Min, Max, IsDate, IsOptional, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCompanyScheduleDto {
  @ApiProperty({
    description: 'Day of week (0=Sunday, 1=Monday, ..., 6=Saturday)',
    example: 1,
    minimum: 0,
    maximum: 6,
  })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @ApiProperty({
    description: 'Start time (ISO string with time only)',
    example: '2024-01-01T09:00:00.000Z',
  })
  @Type(() => Date)
  @IsDate()
  startTime: Date;

  @ApiProperty({
    description: 'End time (ISO string with time only)',
    example: '2024-01-01T17:00:00.000Z',
  })
  @Type(() => Date)
  @IsDate()
  endTime: Date;

  @ApiPropertyOptional({
    description: 'Whether the schedule is active',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}
