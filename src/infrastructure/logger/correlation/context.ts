import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'crypto';

export type CorrelationStore = {
  request_id: string;
  trace_id?: string;
  span_id?: string;
};

export const CorrelationALS = new AsyncLocalStorage<CorrelationStore>();

export function getCorrelation(): CorrelationStore | undefined {
  return CorrelationALS.getStore();
}

export function withCorrelation<T>(fn: () => T, seed?: Partial<CorrelationStore>): T {
  const store: CorrelationStore = {
    request_id: seed?.request_id ?? randomUUID(),
    trace_id: seed?.trace_id,
    span_id: seed?.span_id,
  };

  return CorrelationALS.run(store, fn);
}
