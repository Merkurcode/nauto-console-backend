export interface ICompanyScheduleResponse {
  id: string;
  companyId: string;
  dayOfWeek: number;
  dayOfWeekName: string;
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICompanySchedulesListResponse {
  schedules: ICompanyScheduleResponse[];
  total: number;
  page: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface IWeeklyScheduleSummary {
  totalActiveDays: number;
  totalScheduledHours: number;
  averageHoursPerDay: number;
  daysWithoutSchedule: number[];
}

export interface ICompanyWeeklyScheduleResponse {
  companyId: string;
  weeklySchedule: ICompanyScheduleResponse[];
  summary: IWeeklyScheduleSummary;
}
