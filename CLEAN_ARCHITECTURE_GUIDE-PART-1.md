# Guía Completa de Clean Architecture para NestJS

Esta guía documenta la implementación de Clean Architecture, DDD, CQRS y Event Sourcing en este proyecto NestJS, basada en los patrones reales implementados.

## 📋 Tabla de Contenidos

1. [Arquitectura General](#arquitectura-general)
2. [Estructura de Capas](#estructura-de-capas)
3. [Patrones de Entidades](#patrones-de-entidades)
4. [CQRS Implementation](#cqrs-implementation)
5. [Domain Events](#domain-events)
6. [Value Objects](#value-objects)
7. [Repository Pattern](#repository-pattern)
8. [Dependency Injection](#dependency-injection)
9. [Error Handling](#error-handling)
10. [Testing Strategy](#testing-strategy)
11. [Best Practices](#best-practices)

## 🏛️ Arquitectura General

### Principios Fundamentales

- **Dependency Rule**: Las dependencias solo apuntan hacia adentro
- **Independence**: Cada capa es independiente de las externas
- **Testability**: Todas las capas son testeable de forma aislada
- **Flexibility**: Fácil intercambio de implementaciones
- **Pragmatismo**: Evitar abstracciones innecesarias que no aporten valor

### Decisiones Arquitectónicas Clave

#### 1. CQRS con Flexibilidad
- **Commands**: SIEMPRE usan servicios para centralizar lógica de negocio y efectos secundarios
- **Queries**: Pueden usar repositorios directamente para consultas simples, o servicios cuando hay lógica compleja
- **Justificación**: Evita capas innecesarias en operaciones de lectura simples mientras mantiene la integridad en operaciones de escritura

#### 2. Simplicidad sobre Pureza
- No crear abstracciones "por si acaso"
- Cada capa adicional debe justificar su existencia con valor real
- Es mejor refactorizar cuando se necesite que sobre-diseñar desde el inicio

### Estructura de Capas (De afuera hacia adentro)

```
📁 src/
├── 📁 presentation/     # Capa de Presentación (Controllers, Guards, Middleware)
├── 📁 application/      # Capa de Aplicación (Commands, Queries, DTOs)
├── 📁 core/            # Capa de Dominio (Entities, Services, Events)
├── 📁 infrastructure/   # Capa de Infraestructura (Database, External APIs)
└── 📁 shared/          # Utilidades compartidas (Constants, Decorators)
```

## 🔄 Estructura de Capas

### 1. Core/Domain Layer (`src/core/`)

**Propósito**: Contiene la lógica de negocio pura sin dependencias externas.

```typescript
📁 core/
├── 📁 entities/           # Entidades de dominio
├── 📁 value-objects/      # Value Objects con validaciones
├── 📁 events/            # Eventos de dominio
├── 📁 services/          # Servicios de dominio
├── 📁 repositories/      # Interfaces de repositorios
├── 📁 specifications/    # Business rules
├── 📁 exceptions/        # Excepciones de dominio
└── 📁 interfaces/        # Contratos de dominio
```

**Reglas**:
- ❌ NO debe depender de capas externas
- ✅ Contiene toda la lógica de negocio
- ✅ Define interfaces que las capas externas implementan
- ✅ Es el núcleo estable del sistema

### 2. Application Layer (`src/application/`)

**Propósito**: Orquesta las operaciones de dominio usando CQRS.

```typescript
📁 application/
├── 📁 commands/          # Write operations (CUD) - Commands + Handlers in same file
├── 📁 queries/           # Read operations - Queries + Handlers in same file
├── 📁 dtos/             # Data Transfer Objects
│   └── 📁 _responses/   # Interfaces de respuesta
│       └── 📁 entity-name/
│           ├── entity-name.response.interface.ts  # Interfaz pura del response
│           ├── entity-name.response.ts             # Re-export para compatibilidad
│           └── entity-name.swagger.dto.ts          # Clase con decoradores Swagger
└── 📁 mappers/          # Transformación entre capas
```

**Reglas**:
- ✅ Implementa casos de uso específicos
- ✅ Coordina entre dominio e infraestructura
- ✅ Maneja transacciones
- ❌ NO contiene lógica de negocio

#### Response Pattern (`src/application/dtos/_responses/`)

**Convención de Triple Archivo**:

En el directorio `_responses` se implementa un patrón de triple archivo para separar la lógica de negocio de la documentación Swagger:

```typescript
📁 dtos/_responses/ai-persona/
├── ai-persona.response.interface.ts    # Interfaz pura (para lógica de negocio)
├── ai-persona.response.ts              # Re-export para compatibilidad
└── ai-persona.swagger.dto.ts           # Clase con decoradores (para Swagger)
```

**1. Interfaz de Response** (`.response.interface.ts`):
```typescript
// src/application/dtos/_responses/ai-persona/ai-persona.response.interface.ts
export interface IAIPersonaResponse {
  id: string;
  name: string;
  keyName: string;
  tone: string;
  personality: string;
  objective: string;
  isDefault: boolean;
  companyId: string | null;
  isActive: boolean;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

**2. Archivo de Re-export** (`.response.ts`):
```typescript
// src/application/dtos/_responses/ai-persona/ai-persona.response.ts
// Re-export interfaces for backward compatibility
export { IAIPersonaResponse } from './ai-persona.response.interface';
```

**3. Clase Swagger** (`.swagger.dto.ts`):
```typescript
// src/application/dtos/_responses/ai-persona/ai-persona.swagger.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AIPersonaSwaggerDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  keyName: string;
  
  // ... resto de propiedades con decoradores Swagger
}
```

**Uso en el Código**:

- **Mappers y CQRS**: Usan la interfaz (`IAIPersonaResponse`)
- **Controllers**: Usan la clase Swagger en decoradores `@ApiResponse()`
- **Return types**: Siempre usar la interfaz

```typescript
// ✅ Correcto - Mapper usa interfaz
public static toResponse(aiPersona: AIPersona): IAIPersonaResponse {
  return { /* ... */ };
}

// ✅ Correcto - Controller usa clase Swagger para documentación
@ApiResponse({ status: HttpStatus.OK, type: AIPersonaSwaggerDto })
async findOne(@Param('id') id: string): Promise<IAIPersonaResponse> {
  // Return type es interfaz
}
```

**Beneficios**:
- **Separación de responsabilidades**: Lógica vs documentación
- **Testabilidad**: Tests usan interfaces sin dependencias de Swagger
- **Flexibilidad**: Fácil cambio de documentación sin afectar lógica
- **Clean Architecture**: Respeta la regla de dependencias

### 3. Infrastructure Layer (`src/infrastructure/`)

**Propósito**: Implementa interfaces definidas en el dominio.

```typescript
📁 infrastructure/
├── 📁 database/         # Prisma, conexiones DB
├── 📁 repositories/     # Implementaciones de repositorios
├── 📁 auth/            # Providers de autenticación
├── 📁 storage/         # Sistemas de almacenamiento
├── 📁 cache/           # Sistema de caché
└── 📁 config/          # Configuraciones
```

**Reglas**:
- ✅ Implementa interfaces del dominio
- ✅ Maneja persistencia y APIs externas
- ✅ Configurable e intercambiable
- ❌ NO contiene lógica de negocio

#### Configuration Management (`src/infrastructure/config/`)

**REGLA FUNDAMENTAL**: Todas las variables de entorno deben ser gestionadas centralmente a través del sistema de configuración estructurada. **NUNCA** acceder a `process.env` directamente en servicios o controladores.

**Estructura de Configuración**:

```typescript
// ✅ CORRECTO: src/infrastructure/config/configuration.ts
export default () => ({
  // Configuraciones agrupadas lógicamente
  security: {
    sessionSecret: process.env.SESSION_SECRET,
    requestIntegrityEnabled: process.env.REQUEST_INTEGRITY_ENABLED === 'true', // String → Boolean
    corsOrigins: process.env.ALLOWED_ORIGINS?.split(',') || [], // String → Array
  },
  database: {
    url: process.env.DATABASE_URL,
    poolTimeout: parseInt(process.env.DATABASE_POOL_TIMEOUT || '30', 10), // String → Number
  },
  features: {
    otpEnabled: process.env.OTP_ENABLED === 'true',
    emailVerificationEnabled: process.env.EMAIL_VERIFICATION_ENABLED === 'true',
  },
});
```

**Flujo de Implementación**:

1. **Agregar variable a archivos .env**:
```bash
# .env.example y .env
NEW_FEATURE_TIMEOUT=300
ENABLE_ADVANCED_LOGGING=true
```

2. **Registrar en configuration.ts con transformación de tipos**:
```typescript
export default () => ({
  features: {
    advancedLoggingEnabled: process.env.ENABLE_ADVANCED_LOGGING === 'true',
    newFeatureTimeout: parseInt(process.env.NEW_FEATURE_TIMEOUT || '300', 10),
  },
});
```

3. **Acceder mediante paths estructurados**:
```typescript
// ✅ CORRECTO - Path estructurado con tipo apropiado
@Injectable()
export class SomeService {
  constructor(private configService: ConfigService) {}
  
  private isLoggingEnabled(): boolean {
    return this.configService.get<boolean>('features.advancedLoggingEnabled', false);
  }
  
  private getTimeout(): number {
    return this.configService.get<number>('features.newFeatureTimeout', 300);
  }
}

// ❌ INCORRECTO - Acceso directo sin transformación
const enabled = this.configService.get<string>('ENABLE_ADVANCED_LOGGING'); // Wrong type!
const timeout = process.env.NEW_FEATURE_TIMEOUT; // Bypasses configuration system!
```

**Categorías de Configuración Recomendadas**:
- `security.*` - JWT, encriptación, CORS, autenticación
- `database.*` - Conexiones, pools, timeouts
- `storage.*` - MinIO, S3, file handling
- `email.*` - SMTP, templates, providers
- `features.*` - Feature flags, toggles
- `logging.*` - Niveles, destinos, formatos
- `external.*` - APIs externas, webhooks

**Beneficios del Patrón Estructurado**:
- **Type Safety**: Conversión automática de tipos (string → boolean/number)
- **Default Values**: Valores por defecto centralizados y documentados
- **Validation**: Un solo lugar para validar variables de entorno
- **Organization**: Agrupación lógica por dominio funcional
- **Maintainability**: Fácil localización y modificación de configuraciones
- **Testing**: Fácil mockeo de configuraciones en tests

**Anti-Patrones a Evitar**:
```typescript
// ❌ Acceso directo a process.env en servicios
const dbUrl = process.env.DATABASE_URL;

// ❌ Sin transformación de tipos
const isEnabled = this.configService.get('FEATURE_ENABLED'); // Returns string "false" 

// ❌ Múltiples defaults dispersos en el código
const timeout = process.env.TIMEOUT || '30'; // Should be centralized

// ❌ Configuraciones hardcodeadas
const maxRetries = 3; // Should be configurable via env var
```

### 4. Presentation Layer (`src/presentation/`)

**Propósito**: Maneja la interacción con el mundo exterior.

```typescript
📁 presentation/
├── 📁 modules/          # Módulos de NestJS (TODOS los controllers van aquí)
│   └── 📁 feature-name/ # Cada feature tiene su propia carpeta
│       ├── feature-name.controller.ts
│       └── feature-name.module.ts
├── 📁 guards/          # Guards de autenticación/autorización
├── 📁 interceptors/    # Interceptores
├── 📁 filters/         # Exception filters
└── 📁 middleware/      # Middleware personalizado
```

**REGLA CRÍTICA**: TODOS los controllers deben estar en `src/presentation/modules/feature-name/`, NUNCA en una carpeta `controllers` separada.

**Estructura Obligatoria por Feature**:
```typescript
📁 modules/
└── 📁 ai-persona/
    ├── ai-persona.controller.ts  # ✅ Controller dentro de módulo
    └── ai-persona.module.ts      # ✅ Módulo con configuración
```

**Reglas**:
- ✅ Punto de entrada HTTP/GraphQL
- ✅ Validación de entrada
- ✅ Transformación de respuestas
- ✅ Controllers SIEMPRE en carpetas de módulos
- ❌ NO contiene lógica de negocio
- ❌ NUNCA carpeta `controllers` separada

## 🔄 CQRS Implementation Patterns

### Commands and Queries File Structure

**NUEVA REGLA**: Commands y Queries deben consolidarse con sus handlers en el mismo archivo para reducir la complejidad y mejorar la cohesión.

#### Command Pattern (Write Operations)

```typescript
// ✅ src/application/commands/entity-name/action-entity-name.command.ts
import { ICommand } from '@nestjs/cqrs';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

// 1. Define el Command
export class CreateCompanyAIConfigCommand implements ICommand {
  constructor(
    public readonly companyId: string,
    public readonly configData: CreateCompanyAIConfigDto,
  ) {}
}

// 2. Define el Handler en el mismo archivo
@CommandHandler(CreateCompanyAIConfigCommand)
export class CreateCompanyAIConfigHandler implements ICommandHandler<CreateCompanyAIConfigCommand, IResponse> {
  constructor(
    @Inject(SERVICE_TOKENS.COMPANY_SERVICE)
    private readonly companyService: ICompanyService,
  ) {}

  async execute(command: CreateCompanyAIConfigCommand): Promise<IResponse> {
    const { companyId, configData } = command;
    const company = await this.companyService.createAIConfiguration(companyId, configData);
    
    return {
      companyId: company.id.getValue(),
      // ... map response
    };
  }
}
```

#### Query Pattern (Read Operations)

```typescript
// ✅ src/application/queries/entity-name/get-entity-name.query.ts
import { IQuery } from '@nestjs/cqrs';
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';

// 1. Define la Query
export class GetCompanyAIConfigQuery implements IQuery {
  constructor(
    public readonly companyId: string,
  ) {}
}

// 2. Define el Handler en el mismo archivo
@QueryHandler(GetCompanyAIConfigQuery)
export class GetCompanyAIConfigHandler implements IQueryHandler<GetCompanyAIConfigQuery, IResponse> {
  constructor(
    @Inject(REPOSITORY_TOKENS.COMPANY_REPOSITORY)
    private readonly companyRepository: ICompanyRepository,
  ) {}

  async execute(query: GetCompanyAIConfigQuery): Promise<IResponse> {
    const { companyId } = query;
    const company = await this.companyRepository.findById(companyId);
    
    if (!company) {
      throw new EntityNotFoundException('Company not found', companyId);
    }

    return {
      companyId: company.id.getValue(),
      // ... map response
    };
  }
}
```

### Nomenclatura Estándar

#### Commands (Write Operations)
- Archivo: `{action}-{entity-name}.command.ts`
- Clase Command: `{Action}{EntityName}Command`
- Clase Handler: `{Action}{EntityName}Handler`

**Ejemplos**:
```
create-company-ai-config.command.ts
update-company-ai-config.command.ts
delete-company-ai-config.command.ts
```

#### Queries (Read Operations)
- Archivo: `get-{entity-name}.query.ts`
- Clase Query: `Get{EntityName}Query`
- Clase Handler: `Get{EntityName}Handler`

**Ejemplos**:
```
get-company-ai-config.query.ts
get-company-hierarchy.query.ts
get-companies.query.ts
```

### Module Registration

```typescript
// feature.module.ts
@Module({
  // ...
  providers: [
    // Commands
    CreateEntityHandler,  // Solo el Handler se registra
    UpdateEntityHandler,
    DeleteEntityHandler,
    
    // Queries
    GetEntityHandler,     // Solo el Handler se registra
    GetEntitiesHandler,
  ],
})
export class FeatureModule {}
```

**Ventajas del nuevo patrón**:
- ✅ Reducida complejidad de archivos
- ✅ Mayor cohesión (comando y handler juntos)
- ✅ Menos imports en módulos
- ✅ Menor overhead de mantenimiento

## 🏗️ Patrones de Entidades

### Estructura de Entidad

```typescript
// ✅ Patrón correcto implementado
export class UserActivityLog extends AggregateRoot {
  // 1. Campos privados con prefijo underscore
  private readonly _id: string;
  private readonly _userId: UserId;
  private readonly _version: string;
  private readonly _timestamp: Date;

  // 2. Constructor privado
  private constructor(
    id: string,
    userId: UserId,
    version: string,
    timestamp: Date
  ) {
    super();
    this._id = id;
    this._userId = userId;
    this._version = version;
    this._timestamp = timestamp;
  }

  // 3. Factory method para crear nuevas instancias
  public static create(props: IProps): UserActivityLog {
    const version = process.env.API_VERSION || '1.0.0';
    const instance = new UserActivityLog(
      this.generateId(),
      props.userId,
      version,
      new Date()
    );
    
    // 4. Agregar eventos de dominio
    instance.addDomainEvent(new UserActivityLogCreatedEvent(...));
    return instance;
  }

  // 5. Factory method para reconstituir desde persistencia
  public static fromPersistence(props: IProps, id: string): UserActivityLog {
    return new UserActivityLog(id, props.userId, props.version, props.timestamp);
  }

  // 6. Getters públicos
  get id(): string { return this._id; }
  get version(): string { return this._version; }

  // 7. Métodos de negocio
  public methodName(): void {
    // Lógica de negocio
    this.addDomainEvent(new SomethingHappenedEvent(...));
  }
}
```

### Reglas de Entidades

1. **Campos Privados**: Usar `private readonly _fieldName`
2. **Constructor Privado**: Solo accesible internamente
3. **Factory Methods**: `create()` para nuevas instancias, `fromPersistence()` para reconstitución
4. **Eventos de Dominio**: Agregar en operaciones importantes
5. **Value Objects**: Usar para tipos complejos
6. **Encapsulación**: No exponer estado mutable

## ⚡ CQRS Implementation

### Command Pattern (Write Operations)

**REGLA CRÍTICA**: Los Command Handlers **DEBEN usar ÚNICAMENTE servicios**, nunca repositorios directamente.

```typescript
// ✅ CORRECTO - Command Handler usando Service
@CommandHandler(CreateUserActivityLogCommand)
export class CreateUserActivityLogCommandHandler {
  constructor(
    private readonly userActivityLogService: UserActivityLogService, // ✅ Service, no repository
  ) {}

  async execute(command: CreateUserActivityLogCommand): Promise<void> {
    // 1. Usar service para toda la lógica de negocio
    await this.userActivityLogService.createUserActivityLog(
      command.userId,
      command.activityType,
      command.action,
      command.description,
      command.impact,
    );

    // 2. Los eventos se publican automáticamente en el service
  }
}

// ❌ INCORRECTO - Command Handler usando Repository directamente
@CommandHandler(CreateUserActivityLogCommand)
export class CreateUserActivityLogCommandHandler {
  constructor(
    @Inject(USER_ACTIVITY_LOG_REPOSITORY)
    private readonly repository: IUserActivityLogRepository, // ❌ Repository directo
  ) {}
}
```

**Razones para usar Services en Commands**:
- **Centralización**: Toda la lógica de negocio está en el service
- **Reutilización**: El service puede ser usado por otros commands/queries
- **Transacciones**: El service maneja la coordinación transaccional
- **Eventos**: El service se encarga de publicar eventos de dominio
- **Validaciones**: El service contiene todas las validaciones de negocio

### Query Pattern (Read Operations)

**ENFOQUE PRAGMÁTICO**: Los Query Handlers pueden usar repositorios directamente O servicios, según la complejidad del caso.

#### Cuándo usar Repositorios directamente en Queries

```typescript
// ✅ CORRECTO - Query simple usando Repository directamente
@QueryHandler(GetUserByIdQuery)
export class GetUserByIdQueryHandler {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository, // ✅ Repository directo para lectura simple
  ) {}

  async execute(query: GetUserByIdQuery): Promise<IUserResponse> {
    const user = await this.userRepository.findById(query.id);
    if (!user) {
      throw new UserNotFoundException(query.id);
    }
    return UserMapper.toResponse(user);
  }
}
```

**Usa repositorios directamente cuando**:
- La consulta es simple (find by ID, list all, etc.)
- No hay lógica de negocio adicional
- No se requiere coordinación entre múltiples fuentes
- La respuesta es directa sin transformaciones complejas

#### Cuándo usar Services en Queries

```typescript
// ✅ CORRECTO - Query complejo usando Service
@QueryHandler(GetUserActivityLogsQuery)
export class GetUserActivityLogsQueryHandler {
  constructor(
    private readonly userActivityLogService: UserActivityLogService, // ✅ Service para lógica compleja
  ) {}

  async execute(query: GetUserActivityLogsQuery): Promise<IUserActivityLogPaginatedResponse> {
    // Service maneja validación de permisos, filtrado complejo, etc.
    const { logs, total } = await this.userActivityLogService.validateAndGetActivityLogs(
      query.currentUserId,
      query.targetUserId,
      query.accessType,
      query.filters,
    );

    return UserActivityLogMapper.toPaginatedResponse(logs, total, query.page, query.limit);
  }
}
```

**Usa services cuando**:
- Hay lógica de negocio (validaciones, cálculos)
- Se requiere coordinación entre múltiples repositorios
- Necesitas reutilizar la lógica en múltiples lugares
- Hay reglas de autorización complejas
- Se requieren transformaciones de datos elaboradas

#### Recomendación Práctica

**Para operaciones de lectura simples**: Es totalmente aceptable y preferible usar directamente los repositorios desde los QueryHandlers, especialmente si los datos no requieren lógica adicional ni coordinación entre múltiples fuentes.

**Para casos complejos**: Si la consulta implica lógica de negocio, combinaciones de datos o transformaciones, usa un servicio. Pero hazlo solo si aporta claridad, reutilización o reduce la complejidad.

**Principio guía**: Aplica Clean Architecture con simplicidad, evitando abstraer sin motivo real.

### Reglas CQRS

1. **Separación**: Commands modifican estado, Queries solo leen
2. **Handlers**: Un handler por command/query
3. **Commands usan Services**: Los Command Handlers SIEMPRE deben usar servicios (para mantener lógica de negocio centralizada)
4. **Queries son flexibles**: 
   - Pueden usar repositorios directamente para consultas simples
   - Deben usar servicios para lógica compleja o coordinación
5. **Pragmatismo**: No crear abstracciones innecesarias
6. **DTOs**: Diferentes DTOs para commands y queries
7. **Validation**: En el comando/query, no en el handler
8. **Transactions**: Solo en commands, nunca en queries

## 📡 Domain Events

### Definición de Eventos

```typescript
export class UserActivityLogCreatedEvent extends DomainEvent {
  constructor(
    public readonly userActivityLogId: string,
    public readonly userId: UserId,
    public readonly activityType: UserActivityType,
    public readonly action: string,
    public readonly description: string,
    public readonly impact: UserActivityImpact,
    public readonly version: string,  // ✅ Incluir version siempre
    public readonly ipAddress?: string,
    public readonly userAgent?: string,
    public readonly metadata?: Record<string, unknown>,
  ) {
    super();
  }

  getEventName(): string {
    return 'user_activity_log.created';
  }
}
```

### Uso en Entidades

```typescript
export class UserActivityLog extends AggregateRoot {
  public static create(props: IProps): UserActivityLog {
    const instance = new UserActivityLog(...);
    
    // Evento principal
    instance.addDomainEvent(new UserActivityLogCreatedEvent(...));
    
    // Eventos específicos por impacto
    switch (props.impact.getValue()) {
      case UserActivityImpactEnum.HIGH:
        instance.addDomainEvent(new HighImpactActivityLoggedEvent(...));
        break;
    }
    
    return instance;
  }
}
```

### Event Handlers

```typescript
@EventsHandler(UserActivityLogCreatedEvent)
export class UserActivityLogCreatedEventHandler {
  async handle(event: UserActivityLogCreatedEvent): Promise<void> {
    // Lógica de side effects
    // Notificaciones, actualizaciones derivadas, etc.
  }
}
```

### Reglas de Eventos

1. **Inmutables**: Los eventos nunca cambian una vez creados
2. **Ricos en Información**: Incluir toda la información relevante
3. **Versionado**: Incluir versión para compatibilidad
4. **Naming**: Usar pasado (`Created`, `Updated`, `Deleted`)
5. **Granularidad**: Eventos específicos y eventos generales

## 💎 Value Objects

### Estructura Base

```typescript
export abstract class ValueObject<T> {
  protected readonly _value: T;

  constructor(value: T) {
    this.validate(value);
    this._value = value;
  }

  protected abstract validate(value: T): void;

  public getValue(): T {
    return this._value;
  }

  public equals(other: ValueObject<T>): boolean {
    return this._value === other._value;
  }
}
```

### Implementación Específica

```typescript
export class Email extends ValueObject<string> {
  protected validate(value: string): void {
    if (!value || !this.isValidEmail(value)) {
      throw new InvalidEmailException(value);
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Factory methods estáticos
  public static create(value: string): Email {
    return new Email(value);
  }

  public static fromString(value: string): Email {
    return new Email(value);
  }
}
```

### Reglas de Value Objects

1. **Inmutabilidad**: Nunca cambian después de creación
2. **Validación**: En el constructor
3. **Factory Methods**: Para facilitar creación
4. **Equality**: Basada en valor, no referencia
5. **No Identity**: No tienen ID único

## 🗄️ Repository Pattern

### Interface de Dominio

```typescript
// En src/core/repositories/
export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(user: User): Promise<User>;
  update(user: User): Promise<User>;
  delete(id: string): Promise<boolean>;
}
```

### Patrón Estándar de Implementación

**TODOS los repositorios DEBEN seguir este patrón obligatorio:**

```typescript
// En src/infrastructure/repositories/
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';
import { TransactionContextService } from '@infrastructure/database/prisma/transaction-context.service';
import { BaseRepository } from './base.repository';
import { User } from '@core/entities/user.entity';
import { IUserRepository } from '@core/repositories/user.repository.interface';

@Injectable()
export class UserRepository extends BaseRepository<User> implements IUserRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionContext: TransactionContextService,
  ) {
    super(); // ¡OBLIGATORIO!
  }

  private get client() {
    return this.transactionContext.getTransactionClient() || this.prisma;
  }

  async findById(id: string): Promise<User | null> {
    return this.executeWithErrorHandling('findById', async () => {
      const record = await this.client.user.findUnique({
        where: { id },
        include: { /* relations */ },
      });

      return record ? this.mapToModel(record) : null;
    });
  }

  async create(user: User): Promise<User> {
    return this.executeWithErrorHandling('create', async () => {
      const data = this.mapToPersistence(user);
      
      const created = await this.client.user.create({
        data,
        include: { /* relations */ },
      });

      return this.mapToModel(created);
    });
  }
}
```

### Patrones Especiales para Logs/Auditoría

**Para repositorios que NO deben usar transacciones (logs, auditoría):**

```typescript
@Injectable()
export class AuditLogRepository extends BaseRepository<AuditLog> implements IAuditLogRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionContext: TransactionContextService,
  ) {
    super();
  }

  // IMPORTANTE: Los logs de auditoría NO usan transacciones por defecto
  // para garantizar que se persistan incluso si falla la operación principal
  private get client() {
    return this.prisma; // Siempre usa conexión directa
  }

  // O para permitir uso opcional de transacciones:
  private getClient(useTransaction = false) {
    return useTransaction 
      ? this.transactionContext.getTransactionClient() || this.prisma
      : this.prisma;
  }
}
```

### Reglas Obligatorias de Repositorio

1. **✅ DEBE extender BaseRepository<EntityType>**: Proporciona manejo consistente de errores
2. **✅ DEBE incluir TransactionContextService**: Para soporte transaccional
3. **✅ DEBE llamar super()** en el constructor
4. **✅ DEBE usar private get client()**: Para manejo transaccional consistente
5. **✅ DEBE usar this.executeWithErrorHandling()**: Para operaciones que pueden fallar
6. **✅ Interface en Dominio**: Define el contrato
7. **✅ Mappers**: Para transformar entre dominio y persistencia

### Excepciones al Patrón

- **user-auth.repository.ts**: Simplificado para JWT auth únicamente
- **audit-log.repository.ts**: Los logs persisten fuera de transacciones
- **user-activity-log.repository.ts**: Los logs de actividad persisten fuera de transacciones

## 🔌 Dependency Injection

### Tokens de Inyección

```typescript
// src/shared/constants/tokens.ts
export const USER_ACTIVITY_LOG_REPOSITORY = 'UserActivityLogRepository';
export const AUDIT_LOG_SERVICE = 'AuditLogService';
```

### Configuración en Módulos

```typescript
// Infrastructure Module
@Module({
  providers: [
    {
      provide: USER_ACTIVITY_LOG_REPOSITORY,
      useClass: UserActivityLogRepository,
    },
  ],
  exports: [USER_ACTIVITY_LOG_REPOSITORY],
})
export class InfrastructureModule {}

// Core Module
@Module({
  imports: [InfrastructureModule],
  providers: [UserActivityLogService],
  exports: [UserActivityLogService],
})
export class CoreModule {}
```

### Uso en Services

```typescript
@Injectable()
export class UserActivityLogService {
  constructor(
    @Inject(USER_ACTIVITY_LOG_REPOSITORY)
    private readonly repository: IUserActivityLogRepository,
    private readonly eventBus: EventBus,
  ) {}
}
```

## 🎯 Error Handling

### Excepciones de Dominio

**REGLA CRÍTICA**: Las excepciones de dominio NUNCA deben extender directamente de `Error`. Deben extender de `DomainException` o crear una jerarquía específica del dominio.

#### Patrón de Jerarquía de Excepciones

```typescript
// ✅ CORRECTO - Jerarquía de excepciones de dominio
import { DomainException } from '@core/exceptions/domain-exceptions';

// 1. Crear una clase base para el dominio específico
export abstract class AIPersonaDomainException extends DomainException {}

// 2. Extender de la clase base del dominio
export class AIPersonaNotFoundException extends AIPersonaDomainException {
  constructor(id: string) {
    super(
      `AI Persona with id ${id} not found`,
      'AI_PERSONA_NOT_FOUND',  // Código único de error
      { id }  // Contexto adicional
    );
  }
}

export class AIPersonaKeyNameAlreadyExistsException extends AIPersonaDomainException {
  constructor(keyName: string, companyId?: string | null) {
    const context = companyId ? `company ${companyId}` : 'default AI personas';
    super(
      `AI Persona with key name '${keyName}' already exists in ${context}`,
      'AI_PERSONA_KEY_NAME_ALREADY_EXISTS',
      { keyName, companyId }
    );
  }
}

// ❌ INCORRECTO - Extendiendo directamente de Error
export class BadAIPersonaException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BadAIPersonaException';  // ❌ Sin código de error estructurado
  }
}
```

#### Estructura de DomainException

```typescript
// Base class para todas las excepciones de dominio
export abstract class DomainException extends Error {
  constructor(
    message: string,
    public readonly code: string,  // Código único para identificación
    public readonly context?: Record<string, unknown>,  // Datos adicionales
  ) {
    super(message);
    this.name = this.constructor.name;
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
```

#### Beneficios del Patrón

- **Códigos de error estructurados**: Facilita el manejo en el frontend
- **Contexto adicional**: Permite incluir datos útiles para debugging
- **Jerarquía clara**: Facilita el catch específico por tipo de excepción
- **Consistencia**: Todas las excepciones siguen el mismo patrón
- **Mapeo HTTP**: La capa de presentación puede mapear códigos a status HTTP

#### Reglas Críticas de Manejo de Excepciones

**ANTIPATRÓN PROHIBIDO**: `throw new Error()` está completamente prohibido en el código de producción.

```typescript
// ❌ PROHIBIDO - Usar Error directamente
throw new Error('Something went wrong');
throw new Error(`Failed to process ${id}`);

// ✅ OBLIGATORIO - Usar excepciones de dominio específicas
throw new AIPersonaNotFoundException(id);
throw new AIPersonaCompanyAssignmentRemovalException(aiPersonaId, error.message);
```

#### Jerarquía y Reutilización de Excepciones

**REGLA FUNDAMENTAL**: Reutilizar excepciones comunes antes de crear específicas.

**Excepciones Comunes en `domain-exceptions.ts`**:

Las siguientes excepciones son **UNIVERSALES** y deben reutilizarse en lugar de crear versiones específicas por dominio:

```typescript
// 🔄 EXCEPCIONES DE AUTORIZACIÓN - Reutilizar siempre
InsufficientPermissionsException  // Permisos insuficientes
ForbiddenActionException          // Acción prohibida
InvalidSessionException           // Sesión inválida/expirada

// 🔄 EXCEPCIONES DE AUTENTICACIÓN - Reutilizar siempre  
AuthenticationException           // Fallo de autenticación
InvalidCredentialsException       // Credenciales inválidas
AccountLockedException           // Cuenta bloqueada
TwoFactorRequiredException       // 2FA requerido

// 🔄 EXCEPCIONES DE ENTIDADES - Reutilizar siempre
EntityNotFoundException          // Entidad no encontrada (genérica)
EntityAlreadyExistsException     // Entidad ya existe (genérica)

// 🔄 EXCEPCIONES DE VALIDACIÓN - Reutilizar siempre
InvalidInputException            // Input inválido
InvalidValueObjectException      // Value Object inválido
BusinessRuleValidationException  // Violación de regla de negocio

// 🔄 EXCEPCIONES DE RATE LIMITING - Reutilizar siempre
RateLimitExceededException      // Límite de tasa excedido
ThrottlingException             // Violación de throttling
```

**Proceso de Decisión para Excepciones**:

```typescript
// 1️⃣ PRIMERO: ¿Existe una excepción común que cubra este caso?
// ✅ CORRECTO - Usar excepción común
throw new InsufficientPermissionsException('delete_ai_persona', 'AI Persona');

// ❌ INCORRECTO - Crear específica innecesaria  
throw new InsufficientPermissionsAIPersonaException('delete');

// 2️⃣ SEGUNDO: ¿La excepción es realmente específica del dominio?
// ✅ CORRECTO - Caso específico del dominio
throw new CannotModifyDefaultAIPersonaException();
throw new AIPersonaKeyNameAlreadyExistsException(keyName, companyId);

// 3️⃣ TERCERO: ¿Necesita contexto específico del dominio?
// ✅ CORRECTO - Contexto específico necesario
throw new AIPersonaCompanyAssignmentRemovalException(aiPersonaId, error.message);
```

**Ejemplos de Reutilización vs Específica**:

```typescript
// ✅ REUTILIZAR - Casos comunes de autorización
if (!userAuth.canAccessCompany(user, companyId)) {
  throw new ForbiddenActionException(
    'Cannot access company resources', 
    'access', 
    `company:${companyId}`
  );
}

if (!userAuth.canDeleteResource(user, resource)) {
  throw new InsufficientPermissionsException('delete_resource', resource);
}

// ✅ ESPECÍFICA - Lógica específica del dominio AI Persona
if (aiPersona.isDefault && !userAuth.canAccessRootFeatures(user)) {
  throw new CannotModifyDefaultAIPersonaException();
}

if (keyNameExists) {
  throw new AIPersonaKeyNameAlreadyExistsException(keyName, companyId);
}

// ❌ INCORRECTO - Duplicar excepción común
export class CannotAccessCompanyAIPersonaException extends AIPersonaDomainException {
  // ❌ Ya existe ForbiddenActionException para esto
}

export class InsufficientPermissionsAIPersonaException extends AIPersonaDomainException {
  // ❌ Ya existe InsufficientPermissionsException para esto
}
```

**Beneficios de la Reutilización**:
- **Consistencia**: Mismos códigos de error para casos similares
- **Mantenibilidad**: Menos clases de excepción que mantener
- **Frontend friendly**: Manejo unificado de errores comunes
- **DRY Principle**: No repetir lógica de excepción
- **Interoperabilidad**: Excepciones comunes entre dominios

**Proceso obligatorio para excepciones**:

1. **Identificar el dominio**: Determinar a qué dominio pertenece la excepción
2. **Verificar jerarquía existente**: Revisar si existe una clase base para el dominio
3. **Crear clase base si no existe**: `[Domain]DomainException extends DomainException`
4. **Crear excepción específica**: Extender de la clase base del dominio
5. **Incluir código único**: Proporcionar código de error identificable
6. **Agregar contexto**: Incluir datos útiles para debugging

**Ejemplo completo de implementación**:

```typescript
// 1. Clase base del dominio (si no existe)
export abstract class AIPersonaDomainException extends DomainException {}

// 2. Excepción específica con toda la información
export class AIPersonaCompanyAssignmentRemovalException extends AIPersonaDomainException {
  constructor(aiPersonaId: string, error: string) {
    super(
      `Failed to remove company assignments for AI Persona ${aiPersonaId}: ${error}`,
      'AI_PERSONA_COMPANY_ASSIGNMENT_REMOVAL_FAILED',  // Código único
      { aiPersonaId, error }  // Contexto para debugging
    );
  }
}

// 3. Uso en el código
try {
  await this.removeAssignments(id);
} catch (error) {
  // ✅ Usar excepción específica con contexto
  throw new AIPersonaCompanyAssignmentRemovalException(id, error.message);
}
```

**Beneficios de seguir este patrón**:
- **Debugging mejorado**: Contexto específico en cada excepción
- **Manejo granular**: Catch específico por tipo de error
- **Códigos estructurados**: Frontend puede manejar errores por código
- **Consistency**: Todas las excepciones siguen el mismo patrón
- **Auditabilidad**: Fácil tracking de tipos de errores específicos

### Exception Filters

```typescript
@Catch(UserActivityLogNotFoundException)
export class UserActivityLogNotFoundExceptionFilter implements ExceptionFilter {
  catch(exception: UserActivityLogNotFoundException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    
    response.status(404).json({
      statusCode: 404,
      message: exception.message,
      error: 'Not Found',
      code: exception.code,  // ✅ Incluir código de error
      context: exception.context,  // ✅ Incluir contexto si es apropiado
    });
  }
}
```

## 🧪 Testing Strategy

### Unit Tests - Dominio

```typescript
describe('UserActivityLog Entity', () => {
  it('should create user activity log with version', () => {
    const props = {
      userId: UserId.fromString('user-id'),
      activityType: UserActivityType.AUTHENTICATION(),
      action: 'login',
      description: 'User logged in',
      impact: UserActivityImpact.LOW(),
    };

    const log = UserActivityLog.create(props);

    expect(log.version).toBe(process.env.API_VERSION || '1.0.0');
  });
});
```

### Integration Tests - Repository

```typescript
describe('UserActivityLogRepository', () => {
  it('should save and retrieve user activity log', async () => {
    const log = UserActivityLog.create({...});
    
    await repository.save(log);
    const retrieved = await repository.findById(log.id);
    
    expect(retrieved).toBeDefined();
    expect(retrieved.id).toBe(log.id);
  });
});
```

### E2E Tests - API

```typescript
describe('UserActivityLog API', () => {
  it('should get user activity logs', async () => {
    const response = await request(app.getHttpServer())
      .get('/user-activity-logs/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.data).toBeDefined();
  });
});
```

