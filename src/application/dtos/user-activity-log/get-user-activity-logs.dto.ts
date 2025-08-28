import { IsOptional, IsEnum, IsString, IsDateString, IsInt, Min, Max } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { UserActivityType } from '@shared/constants/user-activity-type.enum';
import { UserActivityImpact } from '@shared/constants/user-activity-impact.enum';

export class GetUserActivityLogsDto {
  @IsOptional()
  @IsEnum(UserActivityType)
  activityType?: UserActivityType;

  @IsOptional()
  @IsEnum(UserActivityImpact)
  impact?: UserActivityImpact;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim?.())
  action?: string;

  @IsOptional()
  @IsDateString()
  @Transform(({ value }) => value?.trim?.())
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  @Transform(({ value }) => value?.trim?.())
  toDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  // Computed property for offset
  get offset(): number {
    return ((this.page || 1) - 1) * (this.limit || 20);
  }
}
