import { ApiProperty } from '@nestjs/swagger';

export class CompanyScheduleResponseDto {
  @ApiProperty({
    description: 'Schedule unique identifier',
    example: 'sched-123-456-789',
  })
  id: string;

  @ApiProperty({
    description: 'Company ID that owns this schedule',
    example: 'comp-123-456-789',
  })
  companyId: string;

  @ApiProperty({
    description: 'Day of week (0=Sunday, 1=Monday, ..., 6=Saturday)',
    example: 1,
  })
  dayOfWeek: number;

  @ApiProperty({
    description: 'Day of week name',
    example: 'Monday',
  })
  dayOfWeekName: string;

  @ApiProperty({
    description: 'Start time',
    example: '2024-01-01T09:00:00Z',
  })
  startTime: Date;

  @ApiProperty({
    description: 'End time',
    example: '2024-01-01T17:00:00Z',
  })
  endTime: Date;

  @ApiProperty({
    description: 'Duration in minutes',
    example: 480,
  })
  durationMinutes: number;

  @ApiProperty({
    description: 'Whether the schedule is active',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Schedule creation timestamp',
    example: '2024-01-15T10:30:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Schedule last update timestamp',
    example: '2024-01-15T14:20:00Z',
  })
  updatedAt: Date;
}

export class CompanySchedulesListResponseDto {
  @ApiProperty({
    description: 'List of company schedules',
    type: [CompanyScheduleResponseDto],
  })
  schedules: CompanyScheduleResponseDto[];

  @ApiProperty({
    description: 'Total number of schedules',
    example: 7,
  })
  total: number;

  @ApiProperty({
    description: 'Pagination information',
    example: {
      limit: 10,
      offset: 0,
      hasMore: false,
    },
  })
  page: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export class WeeklyScheduleSummaryDto {
  @ApiProperty({
    description: 'Total number of active days',
    example: 5,
  })
  totalActiveDays: number;

  @ApiProperty({
    description: 'Total scheduled hours per week',
    example: 40.0,
  })
  totalScheduledHours: number;

  @ApiProperty({
    description: 'Average hours per day',
    example: 8.0,
  })
  averageHoursPerDay: number;

  @ApiProperty({
    description: 'Days without schedule (0=Sunday, 1=Monday, etc.)',
    example: [0, 6],
  })
  daysWithoutSchedule: number[];
}

export class CompanyWeeklyScheduleResponseDto {
  @ApiProperty({
    description: 'Company ID',
    example: 'comp-123-456-789',
  })
  companyId: string;

  @ApiProperty({
    description: 'Weekly schedule ordered by day of week',
    type: [CompanyScheduleResponseDto],
  })
  weeklySchedule: CompanyScheduleResponseDto[];

  @ApiProperty({
    description: 'Schedule summary statistics',
    type: WeeklyScheduleSummaryDto,
  })
  summary: WeeklyScheduleSummaryDto;
}
