import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface IResponse<T> {
  statusCode: number;
  data: T;
  timestamp: string;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, IResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<IResponse<T>> {
    return next.handle().pipe(
      map(data => ({
        statusCode: context.switchToHttp().getResponse().statusCode,
        data,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
