import { v4 as uuidv4 } from 'uuid';
import { ValueObject } from './base.vo';

export class AIAssistantFeatureId extends ValueObject<string> {
  private constructor(value: string) {
    super(value);
    this.validate();
  }

  public static create(): AIAssistantFeatureId {
    return new AIAssistantFeatureId(uuidv4());
  }

  public static fromString(id: string): AIAssistantFeatureId {
    return new AIAssistantFeatureId(id);
  }

  protected validate(): void {
    if (!this.value || typeof this.value !== 'string' || this.value.trim() === '') {
      throw new Error('AI Assistant Feature ID cannot be empty');
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(this.value)) {
      throw new Error('AI Assistant Feature ID must be a valid UUID');
    }
  }

  public getValue(): string {
    return this.value;
  }
}
