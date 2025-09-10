import { EntityId } from './entity-id.vo';

export class BulkProcessingRequestId extends EntityId {
  private constructor(value: string) {
    super(value);
  }

  static create(value?: string): BulkProcessingRequestId {
    return new BulkProcessingRequestId(value || EntityId.generateId());
  }

  static fromString(value: string): BulkProcessingRequestId {
    return new BulkProcessingRequestId(value);
  }
}
