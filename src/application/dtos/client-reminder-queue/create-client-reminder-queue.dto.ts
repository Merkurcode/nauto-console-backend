import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsObject,
  IsEnum,
  IsArray,
  IsBoolean,
  IsInt,
  Min,
  Max,
  Matches,
  IsTimeZone,
  ArrayMaxSize,
  IsDate,
} from 'class-validator';
import {
  NotificationMedium,
  ReminderNotificationOptOutType,
  ReminderFrequency,
} from '@prisma/client';
import { TrimAndValidateLength } from '@shared/decorators/trim-and-validate-length.decorator';
import { Type } from 'class-transformer';

export class CreateClientReminderQueueDto {
  @ApiProperty({
    description: 'Name of the reminder queue',
    example: 'Service Reminder Q1 2024',
  })
  @TrimAndValidateLength({ min: 1, max: 200 })
  name: string;

  @ApiProperty({
    description: 'Description of the reminder queue',
    example: 'Quarterly service reminders for active clients',
    required: false,
  })
  @IsOptional()
  @TrimAndValidateLength({ max: 1000 })
  description?: string;

  @ApiProperty({
    description: 'Template JSON to send to the bot endpoint',
    example: { message: 'Hello {{clientName}}', type: 'reminder' },
  })
  @IsObject()
  template: Record<string, any>;

  @ApiProperty({
    description: 'Target medium for notifications',
    enum: NotificationMedium,
    example: NotificationMedium.WHATSAPP,
  })
  @IsEnum(NotificationMedium)
  targetMedium: NotificationMedium;

  @ApiProperty({
    description: 'Type of notification for opt-out matching',
    enum: ReminderNotificationOptOutType,
    example: ReminderNotificationOptOutType.REMINDERS,
  })
  @IsEnum(ReminderNotificationOptOutType)
  notifyType: ReminderNotificationOptOutType;

  @ApiProperty({
    description: 'Array of call-to-action strings',
    example: ['Schedule Service', 'Contact Us'],
    isArray: true,
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  callActions: string[];

  @ApiProperty({
    description: 'Whether the queue is active',
    example: true,
  })
  @IsBoolean()
  active: boolean;

  @ApiProperty({
    description: 'Start date for the reminder schedule (ISO 8601)',
    example: '2024-01-01T00:00:00Z',
  })
  @Type(() => Date)
  @IsDate()
  startDate: Date;

  @ApiProperty({
    description: 'End date for the reminder schedule (ISO 8601)',
    example: '2024-12-31T23:59:59Z',
  })
  @Type(() => Date)
  @IsDate()
  endDate: Date;

  @ApiProperty({
    description: 'Interval for frequency (1-1000)',
    example: 1,
    minimum: 1,
    maximum: 1000,
  })
  @IsInt()
  @Min(1)
  @Max(1000)
  interval: number;

  @ApiProperty({
    description: 'Days of week for WEEKLY frequency (SU,MO,TU,WE,TH,FR,SA)',
    example: ['MO', 'WE', 'FR'],
    isArray: true,
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Matches(/^(SU|MO|TU|WE|TH|FR|SA)$/, {
    each: true,
    message: 'Each day must be one of: SU, MO, TU, WE, TH, FR, SA',
  })
  @ArrayMaxSize(7)
  days?: string[];

  @ApiProperty({
    description: 'Start hour in HH:MM:SS format (24-hour)',
    example: '09:00:00',
  })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/, {
    message: 'Start hour must be in HH:MM:SS format',
  })
  startHour: string;

  @ApiProperty({
    description: 'End hour in HH:MM:SS format (24-hour)',
    example: '18:00:00',
  })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/, {
    message: 'End hour must be in HH:MM:SS format',
  })
  endHour: string;

  @ApiProperty({
    description: 'Maximum count of successful reminders per client',
    example: 3,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxCount?: number;

  @ApiProperty({
    description: 'Timezone for schedule calculations',
    example: 'America/Mexico_City',
  })
  @IsTimeZone()
  timezone: string;

  @ApiProperty({
    description: 'Frequency of reminders',
    enum: ReminderFrequency,
    example: ReminderFrequency.DAILY,
  })
  @IsEnum(ReminderFrequency)
  frequency: ReminderFrequency;

  @ApiProperty({
    description: 'Stop date/time for the queue (ISO 8601)',
    example: '2024-06-30T23:59:59Z',
    required: false,
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  stopUntil?: Date;
}
