/* eslint-disable prettier/prettier */
import { IQueueDefinition } from '../types';

// TEST
//import {
//  EventProcessor as EventsProcessor,
//  ApiEventBusAdapter as EventsAdapter,
//  ModuleConfig as EventsMC 
//} from './events';
//
//export const Queues: IQueueDefinition[] = [
//  {
//    name: EventsMC.queue.name,
//    processor: EventsProcessor,
//    eventBusAdapter: EventsAdapter,
//    streams: { maxLen: 20_000, approximate: true }
//  },
//] as const;


import {
  AuthEmailEventProcessor,
  AuthEmailEventBusAdapter,
  ModuleConfig as AuthEmailMC 
} from './email';
//
export const Queues: IQueueDefinition[] = [
  {
    name: AuthEmailMC.queue.name,
    processor: AuthEmailEventProcessor,
    eventBusAdapter: AuthEmailEventBusAdapter,
    streams: { maxLen: 20_000, approximate: true }
  },
] as const;
