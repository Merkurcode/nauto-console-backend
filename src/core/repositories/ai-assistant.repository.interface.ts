import { AIAssistant } from '../entities/ai-assistant.entity';

export interface IAIAssistantRepository {
  findAllAvailable(): Promise<AIAssistant[]>;
  findById(id: string): Promise<AIAssistant | null>;
  findByIdWithFeatures(id: string): Promise<AIAssistant | null>;
  findByIds(ids: string[]): Promise<AIAssistant[]>;
}
