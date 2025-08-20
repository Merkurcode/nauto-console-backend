/* eslint-disable prettier/prettier */
import { IJobConfig, IProcessorConfig, IQueueConfig, IQueueModuleConfig } from "src/queues/types";

// Configuración específica para la cola 'events'
const _JobConfig: IJobConfig = {
  attempts: 100, // 100 intentos máximo
  backoff: {
    type: 'fixed',
    delay: 5000, // 5s entre reintentos
  },
  removeOnComplete: 100, // Mantener 100 completados
  removeOnFail: 50, // Mantener 50 fallidos
} as const;

const _QueueConfig: IQueueConfig = {
  name: 'events',
  retryWindowMs: 6 * 60 * 60 * 1000, // 6 horas máximo
} as const;

// Configuración específica para la cola 'events'
const _ProcessorConfig: IProcessorConfig = {
  concurrency: 100, // Alta concurrencia
  maxStalledCount: 3, // Máximo 3 jobs estancados
  stalledInterval: 30000, // 30s para detectar
} as const;

export const ModuleConfig: IQueueModuleConfig = {
  jobs: _JobConfig,
  queue: _QueueConfig,
  processor: _ProcessorConfig,
} as const;
