import { AIAssistant } from '../entities/ai-assistant.entity';

export interface IAIAssistantRepository {
  findAllAvailable(): Promise<AIAssistant[]>;
  findById(id: string): Promise<AIAssistant | null>;
  findByIdWithFeatures(id: string): Promise<AIAssistant | null>;
  findByIds(ids: string[]): Promise<AIAssistant[]>;
  findByName(name: string): Promise<AIAssistant | null>;
  findByNameWithFeatures(name: string): Promise<AIAssistant | null>;
}
