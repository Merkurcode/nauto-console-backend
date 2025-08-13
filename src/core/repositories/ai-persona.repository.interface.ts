import { AIPersona } from '../entities/ai-persona.entity';

/**
 * AI Persona repository interface
 *
 * Implementations:
 * - {@link AIPersona} - Production Prisma/PostgreSQL implementation
 */
export interface IAIPersonaRepository {
  findById(id: string): Promise<AIPersona | null>;
  findByKeyName(keyName: string, companyId?: string | null): Promise<AIPersona | null>;
  findAllDefault(): Promise<AIPersona[]>;
  findAllByCompany(companyId: string): Promise<AIPersona[]>;
  findAll(filters?: {
    isActive?: boolean;
    isDefault?: boolean;
    companyId?: string;
  }): Promise<AIPersona[]>;
  save(persona: AIPersona): Promise<AIPersona>;
  update(persona: AIPersona): Promise<AIPersona>;
  delete(id: string): Promise<boolean>;
  existsByKeyName(keyName: string, companyId?: string | null, excludeId?: string): Promise<boolean>;
}
