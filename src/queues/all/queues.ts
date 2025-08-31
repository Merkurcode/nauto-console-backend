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

import {
  StaleUploadsCleanupProcessor,
  StaleUploadsCleanupService,
  ModuleConfig as StaleUploadsMC
} from './stale-uploads-cleanup';

import {
  UploadsMaintenanceProcessor,
  UploadsMaintenanceService,
  ModuleConfig as UploadsMaintenanceMC
} from './uploads-maintenance';

export const Queues: IQueueDefinition[] = [
  {
    name: AuthEmailMC.queue.name,
    processor: AuthEmailEventProcessor,
    eventBusAdapter: AuthEmailEventBusAdapter,
    streams: { maxLen: 20_000, approximate: true }
  },
  {
    name: StaleUploadsMC.queue.name,
    processor: StaleUploadsCleanupProcessor,
    streams: { maxLen: 10_000, approximate: true }
  },
  {
    name: UploadsMaintenanceMC.queue.name,
    processor: UploadsMaintenanceProcessor,
    streams: { maxLen: 10_000, approximate: true }
  },
] as const;
