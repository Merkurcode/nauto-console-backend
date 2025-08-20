/* eslint-disable prettier/prettier */
import { IQueueDefinition } from '../types';

import {
  EventProcessor as EventsProcessor,
  ApiEventBusAdapter as EventsAdapter,
  ModuleConfig as EventsMC 
} from './events';

export const Queues: IQueueDefinition[] = [
  {
    name: EventsMC.queue.name,
    processor: EventsProcessor,
    eventBusAdapter: EventsAdapter,
    streams: { maxLen: 20_000, approximate: true }
  },
] as const;
