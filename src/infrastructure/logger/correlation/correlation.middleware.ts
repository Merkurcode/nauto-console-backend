import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { CorrelationALS, type CorrelationStore } from './context';

@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const hdr = (name: string) => req.headers[name.toLowerCase()];

    const correlationStore: CorrelationStore = {
      request_id:
        (hdr('x-request-id') as string) || (hdr('x-correlation-id') as string) || randomUUID(),
      trace_id: hdr('x-trace-id') as string,
      span_id: hdr('x-span-id') as string,
    };

    CorrelationALS.run(correlationStore, () => {
      next();
    });
  }
}
