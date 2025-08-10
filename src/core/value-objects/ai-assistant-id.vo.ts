import { EntityId } from './entity-id.vo';

export class AIAssistantId extends EntityId {
  private constructor(value: string) {
    super(value);
  }

  static create(): AIAssistantId {
    return new AIAssistantId(super.generateId());
  }

  static fromString(value: string): AIAssistantId {
    return new AIAssistantId(value);
  }
}
