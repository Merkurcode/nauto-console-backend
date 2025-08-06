import { IsOptional, IsDateString, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateCompanyScheduleDto {
  @ApiPropertyOptional({
    description: 'Start time (ISO string with time only)',
    example: '2024-01-01T08:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  @Type(() => Date)
  startTime?: Date;

  @ApiPropertyOptional({
    description: 'End time (ISO string with time only)',
    example: '2024-01-01T18:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  @Type(() => Date)
  endTime?: Date;

  @ApiPropertyOptional({
    description: 'Whether the schedule is active',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
