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
├── 📁 commands/          # Write operations (CUD)
├── 📁 queries/           # Read operations
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

## ✨ Best Practices

### 1. Diseño de Entidades

```typescript
// ✅ Correcto
export class User extends AggregateRoot {
  private readonly _id: UserId;
  private _email: Email;
  
  private constructor(id: UserId, email: Email) {
    super();
    this._id = id;
    this._email = email;
  }
  
  public static create(email: Email): User {
    const id = UserId.create();
    const user = new User(id, email);
    user.addDomainEvent(new UserCreatedEvent(id, email));
    return user;
  }
  
  public changeEmail(newEmail: Email): void {
    if (this._email.equals(newEmail)) return;
    
    const oldEmail = this._email;
    this._email = newEmail;
    this.addDomainEvent(new EmailChangedEvent(this._id, oldEmail, newEmail));
  }
}

// ❌ Incorrecto
export class User {
  public id: string;  // ❌ Público
  public email: string;  // ❌ Primitivo
  
  constructor(id: string, email: string) {  // ❌ Público
    this.id = id;
    this.email = email;
  }
}
```

### 2. Commands vs Queries

```typescript
// ✅ Command - Modifica estado
export class CreateUserCommand {
  constructor(
    public readonly email: string,
    public readonly password: string,
  ) {}
}

// ✅ Query - Solo lee
export class GetUsersQuery {
  constructor(
    public readonly page: number = 1,
    public readonly limit: number = 10,
    public readonly filters?: UserFilters,
  ) {}
}
```

### 3. Event Naming

```typescript
// ✅ Correcto - Pasado
export class UserRegisteredEvent extends DomainEvent {}
export class EmailChangedEvent extends DomainEvent {}
export class AccountActivatedEvent extends DomainEvent {}

// ❌ Incorrecto - Presente/Futuro
export class UserRegisterEvent extends DomainEvent {}  // ❌
export class ChangeEmailEvent extends DomainEvent {}   // ❌
export class ActivateAccountEvent extends DomainEvent {} // ❌
```

### 4. Value Object Validation

```typescript
// ✅ Correcto
export class Email extends ValueObject<string> {
  protected validate(value: string): void {
    if (!value) {
      throw new InvalidEmailException('Email cannot be empty');
    }
    if (!this.isValidEmailFormat(value)) {
      throw new InvalidEmailException(`Invalid email format: ${value}`);
    }
    if (value.length > 254) {
      throw new InvalidEmailException('Email too long');
    }
  }
}
```

### 5. Repository Implementation

```typescript
// ✅ Opción 1: Usando Mapper
@Injectable()
export class UserRepository implements IUserRepository {
  async save(user: User): Promise<User> {
    const data = UserMapper.toPersistence(user);
    const saved = await this.prisma.user.upsert({
      where: { id: user.id.getValue() },
      update: data,
      create: data,
    });
    return UserMapper.toDomain(saved);
  }
}

// ✅ Opción 2: Definiendo directamente sin mapper
@Injectable()
export class UserRepository implements IUserRepository {
  async save(user: User): Promise<User> {
    const saved = await this.prisma.user.upsert({
      where: { id: user.id.getValue() },
      update: {
        email: user.email.getValue(),
        firstName: user.firstName.getValue(),
        lastName: user.lastName.getValue(),
        isActive: user.isActive,
        updatedAt: new Date(),
      },
      create: {
        id: user.id.getValue(),
        email: user.email.getValue(),
        firstName: user.firstName.getValue(),
        lastName: user.lastName.getValue(),
        passwordHash: user.passwordHash,
        isActive: user.isActive,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        updatedAt: new Date(),
      },
    });
    return UserMapper.toDomain(saved);
  }
}

// ❌ Incorrecto - Exposing Prisma
export class UserRepository {
  async save(user: any): Promise<any> {  // ❌ any
    return this.prisma.user.create({ data: user });  // ❌ Direct Prisma
  }
}
```

**Cuándo usar cada opción:**
- **Mapper**: Cuando la transformación es compleja o se reutiliza en múltiples lugares
- **Directo**: Para casos simples o cuando necesitas control fino sobre campos específicos

**Documentación de Interfaces:**
Todas las interfaces de repositorio deben incluir documentación JSDoc especificando el modelo de Prisma que utilizan:

```typescript
/**
 * User repository interface
 *
 * Implementations:
 * - {@link User} - Production Prisma/PostgreSQL implementation
 */
export interface IUserRepository {
  // methods...
}
```

### 6. Service Layer

```typescript
// ✅ Correcto - Service de dominio
@Injectable()
export class UserService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
    private readonly eventBus: EventBus,
  ) {}

  async registerUser(email: Email, password: Password): Promise<User> {
    // 1. Business rule validation
    const existingUser = await this.userRepo.findByEmail(email);
    if (existingUser) {
      throw new EmailAlreadyExistsException(email.getValue());
    }

    // 2. Create entity
    const user = User.create(email, password);
    
    // 3. Persist
    await this.userRepo.save(user);
    
    // 4. Events are published automatically
    return user;
  }
}
```

### 7. Transaction Management

```typescript
// ✅ Correcto - En Controller
@Controller('users')
export class UserController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly transactionService: TransactionService,
  ) {}

  @Post()
  async createUser(@Body() dto: CreateUserDto) {
    return this.transactionService.executeInTransaction(async () => {
      return this.commandBus.execute(new CreateUserCommand(dto.email, dto.password));
    });
  }
}
```

### 8. Module Organization

**ESTRUCTURA OBLIGATORIA**: Cada feature debe tener su propia carpeta en `src/presentation/modules/`

```typescript
📁 src/presentation/modules/
└── 📁 ai-persona/              # ✅ Carpeta por feature
    ├── ai-persona.controller.ts # ✅ Controller DENTRO del módulo
    └── ai-persona.module.ts     # ✅ Configuración del módulo
```

**Patrón de Módulo Correcto**:
```typescript
// ✅ CORRECTO - src/presentation/modules/ai-persona/ai-persona.module.ts
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { CoreModule } from '@core/core.module';
import { AIPersonaController } from './ai-persona.controller'; // ✅ Import relativo

// Command Handlers
import { CreateAIPersonaCommandHandler } from '@application/commands/ai-persona/create-ai-persona.command';
import { UpdateAIPersonaCommandHandler } from '@application/commands/ai-persona/update-ai-persona.command';
// ... otros handlers

@Module({
  imports: [CqrsModule, CoreModule], // ✅ Dependencies necesarias
  controllers: [AIPersonaController], // ✅ Controller local
  providers: [
    // Command Handlers
    CreateAIPersonaCommandHandler,
    UpdateAIPersonaCommandHandler,
    // Query Handlers
    GetAIPersonaByIdQueryHandler,
    GetAllAIPersonasQueryHandler,
    // No services aquí - están en CoreModule
  ],
  exports: [], // Exports solo si otros módulos necesitan los handlers
})
export class AIPersonaModule {}

// ❌ INCORRECTO - Controller en carpeta separada
// src/presentation/controllers/ai-persona.controller.ts ❌
```

**Importación en App Module**:
```typescript
// src/app.module.ts
import { AIPersonaModule } from '@presentation/modules/ai-persona/ai-persona.module'; // ✅
```

**Beneficios de esta estructura**:
- **Cohesión**: Todo relacionado con una feature está junto
- **Escalabilidad**: Fácil agregar nuevas features sin conflictos
- **Mantenibilidad**: Cambios en una feature están aislados
- **Clarity**: Estructura clara y predecible

## 📏 Code Style Rules

### 1. Naming Conventions

- **Entities**: PascalCase (`UserActivityLog`)
- **Value Objects**: PascalCase + `.vo.ts` (`Email.vo.ts`)
- **Events**: PascalCase + Event suffix (`UserCreatedEvent`)
- **Interfaces**: PascalCase + `I` prefix (`IUserRepository`)
- **Constants**: SCREAMING_SNAKE_CASE (`USER_REPOSITORY`)
- **Response Interfaces**: `I` prefix + PascalCase + Response suffix (`IAIPersonaResponse`)
- **Response Files**: `entity-name.response.interface.ts` para interfaces, `entity-name.swagger.dto.ts` para clases Swagger, `entity-name.response.ts` para re-exports

### 2. File Organization

```
📁 feature-name/
├── feature-name.entity.ts
├── feature-name.service.ts
├── feature-name.repository.interface.ts
├── create-feature-name.command.ts
├── get-feature-name.query.ts
└── feature-name.events.ts
```

### 3. Import Order

```typescript
// 1. Node modules
import { Injectable, Inject } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';

// 2. Domain imports
import { User } from '@core/entities/user.entity';
import { Email } from '@core/value-objects/email.vo';

// 3. Application imports
import { CreateUserCommand } from '@application/commands/user/create-user.command';

// 4. Infrastructure imports
import { UserRepository } from '@infrastructure/repositories/user.repository';

// 5. Shared imports
import { USER_REPOSITORY } from '@shared/constants/tokens';
```

## 🎯 Summary Checklist

Al implementar una nueva feature, verificar:

### Dominio y Aplicación
- [ ] **Entity** sigue el patrón (campos privados, constructor privado, factory methods)
- [ ] **Value Objects** para tipos complejos (cuando aportan valor)
- [ ] **Events** se emiten en operaciones importantes
- [ ] **Repository Interface** en dominio, implementación en infraestructura
- [ ] **Commands** para writes, **Queries** para reads
- [ ] **Commands usan Services** SIEMPRE (lógica de negocio centralizada)
- [ ] **Queries evalúan complejidad**: Repository directo si es simple, Service si hay lógica
- [ ] **Service** en dominio cuando hay lógica de negocio real

### Presentación y Estructura
- [ ] **Controller** en `src/presentation/modules/feature-name/feature-name.controller.ts`
- [ ] **Module** en `src/presentation/modules/feature-name/feature-name.module.ts`
- [ ] **Import relativo** del controller en el módulo (`./feature-name.controller`)
- [ ] **Transactions** en controllers para writes
- [ ] **DTOs** para entrada y salida
- [ ] **Response Interfaces** en `src/application/dtos/_responses/feature-name/`

### Arquitectura General
- [ ] **Mappers** para transformaciones
- [ ] **Module** bien configurado con dependencias
- [ ] **Tests** para cada capa
- [ ] **Error Handling** con excepciones que extienden de `DomainException`
- [ ] **Jerarquía de Excepciones** específica por dominio (e.g., `AIPersonaDomainException`)
- [ ] **Códigos de error** únicos en cada excepción
- [ ] **Configuration** estructurada, no `process.env` directo

## 📚 Referencias Implementadas

### Ejemplos de Arquitectura Correcta

#### CQRS Pattern - Enfoque Pragmático
```typescript
// ✅ CORRECTO - Command Handler (SIEMPRE usa Service)
@CommandHandler(CreateAIPersonaCommand)
export class CreateAIPersonaCommandHandler {
  constructor(
    private readonly aiPersonaService: AIPersonaService, // ✅ Service obligatorio para commands
  ) {}
  
  async execute(command: CreateAIPersonaCommand): Promise<IAIPersonaResponse> {
    const aiPersona = await this.aiPersonaService.createAIPersona(
      command.name,
      command.tone,
      // ... otros parámetros
    );
    return AIPersonaMapper.toResponse(aiPersona);
  }
}

// ✅ CORRECTO - Query Handler Simple (Repository directo)
@QueryHandler(GetAIPersonaByIdQuery)
export class GetAIPersonaByIdQueryHandler {
  constructor(
    @Inject(AI_PERSONA_REPOSITORY)
    private readonly aiPersonaRepository: IAIPersonaRepository, // ✅ Repository OK para query simple
  ) {}
  
  async execute(query: GetAIPersonaByIdQuery): Promise<IAIPersonaResponse> {
    const aiPersona = await this.aiPersonaRepository.findById(query.id);
    if (!aiPersona) {
      throw new AIPersonaNotFoundException(query.id);
    }
    return AIPersonaMapper.toResponse(aiPersona);
  }
}

// ✅ CORRECTO - Query Handler Complejo (Service para lógica)
@QueryHandler(GetCompanyAIPersonasWithStatsQuery)
export class GetCompanyAIPersonasWithStatsQueryHandler {
  constructor(
    private readonly aiPersonaService: AIPersonaService, // ✅ Service para lógica compleja
  ) {}
  
  async execute(query: GetCompanyAIPersonasWithStatsQuery): Promise<IAIPersonaWithStatsResponse[]> {
    // Service coordina múltiples repositorios y aplica lógica de negocio
    return this.aiPersonaService.getAIPersonasWithUsageStats(query.companyId);
  }
}
```

### Features Implementadas con Clean Architecture

#### Jerarquías de Excepciones Existentes
```typescript
// Jerarquías base definidas en domain-exceptions.ts
export abstract class UserDomainException extends DomainException {}
export abstract class RoleDomainException extends DomainException {}
export abstract class AuthenticationDomainException extends DomainException {}
export abstract class FileDomainException extends DomainException {}
export abstract class AIPersonaDomainException extends DomainException {}

// Ejemplo de uso: InvalidIndustryOperationChannelException
export class InvalidIndustryOperationChannelException extends DomainException {
  constructor(value: string) {
    const validValues = Object.values(IndustryOperationChannelEnum).join(', ');
    super(
      `Invalid industry operation channel "${value}". Valid values are: ${validValues}`,
      'INVALID_INDUSTRY_OPERATION_CHANNEL',
      { value, validValues },
    );
  }
}
```

#### Features Completas
- **UserActivityLog**: Ejemplo completo de entidad con eventos y versionado
- **User**: Entidad compleja con múltiples value objects y jerarquía de excepciones
- **AIPersona**: Feature con jerarquía de excepciones y CQRS pragmático
- **AuditLog**: Sistema de auditoría con queries flexibles
- **Events**: Sistema robusto de eventos de dominio
- **Repositories**: Patrón completo con interfaces y implementaciones
- **Modules**: Organización limpia con inyección de dependencias

## 🏆 Reglas de Oro del Proyecto

### 1. Centralización de Constantes y Enums
**NUNCA hardcodear strings** - Siempre usar enums y constantes centralizadas ubicadas en `src/shared/`:

```typescript
// ✅ CORRECTO - Usar enums existentes
import { UserActivityType } from '@shared/constants/user-activity-type.enum';
import { UserActivityImpact } from '@shared/constants/user-activity-impact.enum';

// ✅ CORRECTO - Crear nuevo enum si no existe
export enum NotificationStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
  DELIVERED = 'DELIVERED'
}

// ❌ INCORRECTO - Hardcodear strings
const status = 'PENDING'; // ❌ 
if (type === 'AUTHENTICATION') { // ❌
```

**Estructura de `src/shared/`:**
```
📁 src/shared/
├── 📁 constants/           # Enums y constantes
│   ├── user-activity-type.enum.ts
│   ├── user-activity-impact.enum.ts
│   └── notification-status.enum.ts
├── 📁 interfaces/          # Interfaces compartidas
├── 📁 types/              # Types compartidos
└── 📁 utils/              # Utilidades comunes
```

**Excepción**: Para eventos de dominio NO es necesario crear enums, pueden usar strings directamente.

### 2. Controllers Sin Lógica
**ZERO lógica de negocio en controllers** - Solo Commands y Queries:

```typescript
// ✅ CORRECTO - Controller limpio
@Controller('users')
export class UserController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly transactionService: TransactionService,
  ) {}

  @Post()
  async createUser(@Body() dto: CreateUserDto) {
    return this.transactionService.executeInTransaction(async () => {
      return this.commandBus.execute(new CreateUserCommand(dto));
    });
  }

  @Get(':id')
  async getUserById(@Param('id') id: string) {
    return this.queryBus.execute(new GetUserByIdQuery(id));
  }
}

// ❌ INCORRECTO - Lógica en controller
@Controller('users')
export class UserController {
  @Post()
  async createUser(@Body() dto: CreateUserDto) {
    // ❌ Validación de negocio
    if (!dto.email.includes('@')) {
      throw new BadRequestException('Invalid email');
    }
    
    // ❌ Lógica de autorización
    if (user.role !== 'admin') {
      throw new ForbiddenException();
    }
    
    // ❌ Transformación de datos
    const hashedPassword = await bcrypt.hash(dto.password, 10);
  }
}
```

### 3. Documentación API con Bearer Auth y Tags
**SIEMPRE especificar la string en @ApiBearerAuth()**:

```typescript
// ✅ CORRECTO - Con nombre específico
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UserController {}

// ❌ INCORRECTO - Sin especificar
@ApiBearerAuth() // ❌ Falta la string
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UserController {}
```

**OBLIGATORIO: @ApiTags en minúsculas con guiones**:

```typescript
// ✅ CORRECTO - Minúsculas con guiones
@ApiTags('ai-personas')
@Controller('ai-personas')
export class AIPersonaController {}

@ApiTags('user-activity-logs')
@Controller('user-activity-logs')
export class UserActivityLogController {}

@ApiTags('company-schedules')
@Controller('company-schedules') 
export class CompanySchedulesController {}

// ❌ INCORRECTO - Mayúsculas o espacios
@ApiTags('AI Personas') // ❌ Mayúsculas y espacios
@ApiTags('User Activity Logs') // ❌ Mayúsculas y espacios
@ApiTags('ai_personas') // ❌ Underscore en lugar de guión
@ApiTags('aiPersonas') // ❌ CamelCase
```

**Reglas para @ApiTags**:
- **Minúsculas**: Todos los caracteres en lowercase
- **Guiones**: Usar `-` para separar palabras, nunca espacios o underscores
- **Consistencia**: Debe coincidir con el path del @Controller
- **Plurales**: Usar forma plural cuando sea apropiado (`users`, `ai-personas`)

**Beneficios de esta convención**:
- **URLs consistentes**: Tag coincide con la ruta del controller
- **Swagger organizado**: Agrupación clara y legible en la documentación
- **SEO friendly**: URLs amigables para motores de búsqueda
- **Estándar REST**: Sigue las mejores prácticas de naming en APIs REST

### 🏆 Regla de Oro: Documentación Detallada de API

**ESTÁNDAR OBLIGATORIO**: Todos los endpoints deben documentarse con el mismo nivel de detalle que el `UserController`. 

#### Elementos Obligatorios en Cada Endpoint

**1. @ApiOperation Completa**:
```typescript
@ApiOperation({
  summary: 'Título descriptivo con roles en paréntesis',
  description: 
    'Descripción detallada del endpoint con:\n\n' +
    '- **Explicación de la funcionalidad**\n' +
    '- **Comportamiento específico por rol**\n' +
    '- **Restricciones de acceso**\n\n' +
    '📋 **Required Permission:** <code style="color: #27ae60; background: #e8f8f5; padding: 2px 6px; border-radius: 3px; font-weight: bold;">resource:action</code>\n\n' +
    '👥 **Roles with Access:**\n' +
    '- <code style="color: #d63031; background: #ffcccc; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT</code>\n' +
    '- <code style="color: #0984e3; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ADMIN</code>\n\n' +
    '⚠️ **Restrictions:** Detalle de restricciones específicas'
})
```

**2. @ApiResponse Exhaustivas**:
```typescript
@ApiResponse({ status: HttpStatus.OK, description: 'Operación exitosa' })
@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Datos de entrada inválidos' })
@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Recurso no encontrado' })
@ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Sin permisos requeridos' })
@ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'No autenticado' })
```

**3. @ApiParam/@ApiBody Descriptivos**:
```typescript
@ApiParam({ 
  name: 'id', 
  description: 'Descripción específica del parámetro',
  example: 'uuid-example-value'
})
@ApiBody({
  type: DtoType,
  description: 'Descripción detallada del body y sus campos'
})
```

**4. Esquemas de Respuesta Detallados**:
```typescript
@ApiResponse({
  status: HttpStatus.OK,
  description: 'Descripción de la respuesta exitosa',
  schema: {
    type: 'object',
    properties: {
      id: { type: 'string', example: 'uuid-example' },
      name: { type: 'string', example: 'Ejemplo' },
      // ... todas las propiedades con ejemplos
    }
  }
})
```

#### Formato de Permisos y Roles

**Permisos con styling HTML**:
```typescript
'📋 **Required Permission:** <code style="color: #27ae60; background: #e8f8f5; padding: 2px 6px; border-radius: 3px; font-weight: bold;">resource:action</code>'
```

**Roles con colores específicos**:
```typescript
'👥 **Roles with Access:**\n' +
'- <code style="color: #d63031; background: #ffcccc; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT</code>\n' +
'- <code style="color: #e17055; background: #fab1a0; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT_READONLY</code>\n' +
'- <code style="color: #0984e3; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ADMIN</code>\n' +
'- <code style="color: #00b894; background: #e8f5e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">MANAGER</code>\n' +
'- <code style="color: #e84393; background: #ffeaa7; padding: 2px 6px; border-radius: 3px; font-weight: bold;">SALES_AGENT</code>\n' +
'- <code style="color: #636e72; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">Any authenticated user</code>'
```

**Colores por tipo de permiso**:
- **READ**: `color: #27ae60; background: #e8f8f5` (Verde)
- **WRITE**: `color: #e74c3c; background: #ffeaa7` (Naranja)
- **UPDATE**: `color: #f39c12; background: #fff3cd` (Amarillo)
- **DELETE**: `color: #c0392b; background: #fadbd8` (Rojo)
- **ASSIGN**: `color: #8e44ad; background: #e8daef` (Púrpura)

#### Estructura de Descripción Obligatoria

```typescript
description:
  'Descripción principal de la funcionalidad.\n\n' +
  '**Comportamiento por Rol:**\n' +
  '- **Root**: Descripción específica\n' +
  '- **Admin**: Descripción específica\n' +
  '- **Manager**: Descripción específica\n\n' +
  '📋 **Required Permission:** [...]\n\n' +
  '👥 **Roles with Access:** [...]\n\n' +
  '⚠️ **Restrictions:** Detalles específicos de restricciones'
```

#### Ejemplo Completo (Referencia UserController)

**Ver `src/presentation/modules/user/user.controller.ts`** como ejemplo perfecto de:
- Documentación exhaustiva por endpoint
- Styling consistente de permisos y roles
- Esquemas de respuesta completos
- Manejo de todos los status codes posibles
- Descripciones detalladas del comportamiento por rol

#### Checklist de Documentación Obligatoria

- [ ] **@ApiOperation** con summary y description completa
- [ ] **Permisos** documentados con styling HTML 
- [ ] **Roles** listados con colores específicos
- [ ] **Restricciones** explicadas claramente
- [ ] **@ApiResponse** para todos los status codes posibles
- [ ] **@ApiParam/@ApiBody** con descriptions y examples
- [ ] **Esquemas** detallados para respuestas complejas
- [ ] **Comportamiento por rol** explicado específicamente

#### Antipatrón Prohibido

```typescript
// ❌ PROHIBIDO - Documentación mínima
@ApiOperation({ summary: 'Get users' })
@ApiResponse({ status: 200, description: 'Success' })

// ✅ OBLIGATORIO - Documentación completa como UserController
@ApiOperation({
  summary: 'Get all AI personas with role-based filtering (Root/Admin/Manager)',
  description: '[Descripción completa con roles, permisos, restricciones]'
})
@ApiResponse({ status: HttpStatus.OK, description: '[Descripción específica]' })
@ApiResponse({ status: HttpStatus.FORBIDDEN, description: '[Descripción específica]' })
// ... más responses
```

### 4. Centralización de Autorización Universal
**UserAuthorizationService contiene métodos UNIVERSALES de autorización**:

**Ubicación única**: `src/core/services/user-authorization.service.ts`

**Responsabilidades UNIVERSALES**:
- ✅ Verificación de permisos genéricos (`user.hasPermission()`)
- ✅ Jerarquía de roles (`canAccessRootFeatures()`, `canAccessAdminFeatures()`)
- ✅ Controles de company/tenant (`canAccessCompany()`, `canManageUser()`)
- ✅ Validaciones de usuario activo (`getCurrentUserSafely()`)
- ✅ Niveles de seguridad (`getUserSecurityLevel()`)

**Los servicios específicos USAN estos métodos universales para implementar su lógica:**

```typescript
// ✅ CORRECTO - AIPersonaService usa métodos universales
@Injectable()
export class AIPersonaService {
  constructor(
    private readonly userAuthService: UserAuthorizationService, // ✅ Servicio universal
    @Inject(AI_PERSONA_REPOSITORY) private readonly aiPersonaRepo: IAIPersonaRepository,
  ) {}

  async validateAIPersonaModification(aiPersonaId: string, currentUser: User): Promise<AIPersona> {
    const aiPersona = await this.aiPersonaRepo.findById(aiPersonaId);
    if (!aiPersona) {
      throw new AIPersonaNotFoundException(aiPersonaId);
    }

    // ✅ USAR métodos universales para implementar lógica específica
    if (aiPersona.isDefault && !this.userAuthService.canAccessRootFeatures(currentUser)) {
      throw new CannotModifyDefaultAIPersonaException();
    }

    if (aiPersona.companyId && !this.userAuthService.canAccessCompany(currentUser, aiPersona.companyId)) {
      throw new UnauthorizedAIPersonaModificationException();
    }

    return aiPersona;
  }

  async getCompanyAIPersonas(companyId: string, currentUser: User): Promise<AIPersona[]> {
    // ✅ USAR método universal de autorización de company
    if (!this.userAuthService.canAccessCompany(currentUser, companyId)) {
      return []; // O lanzar excepción según la lógica de negocio
    }

    return this.aiPersonaRepo.findAllByCompany(companyId);
  }
}

// ❌ INCORRECTO - Lógica de autorización hardcodeada
@Injectable()
export class AIPersonaService {
  async validateAIPersonaModification(aiPersonaId: string, userRole: string, userCompanyId?: string): Promise<AIPersona> {
    // ❌ Hardcodear roles y lógica de autorización
    if (aiPersona.isDefault && userRole !== 'root') { // ❌ String hardcodeado
      throw new CannotModifyDefaultAIPersonaException();
    }
    if (aiPersona.companyId !== userCompanyId) { // ❌ Lógica de company dispersa
      throw new UnauthorizedAIPersonaModificationException();
    }
  }
}
```

**Patrón de Reutilización**:
1. **Primero**: Revisar métodos universales existentes en `user-authorization.service.ts`
2. **Segundo**: Si no existe método universal, crearlo en `user-authorization.service.ts`
3. **Tercero**: Los servicios específicos USAN estos métodos universales
4. **Nunca**: Duplicar lógica de autorización o hardcodear roles/permisos

**Métodos universales del servicio**:
```typescript
// Métodos UNIVERSALES existentes
class UserAuthorizationService {
  // Verificación de características de usuario
  canAccessRootFeatures(user: User): boolean
  canAccessAdminFeatures(user: User): boolean
  canAccessCompany(user: User, companyId: string): boolean
  
  // Gestión de usuarios
  canManageUser(currentUser: User, targetUser: User): boolean
  getCurrentUserSafely(userId: string): Promise<User>
  
  // Permisos y recursos
  canAccessResource(user: User, resource: string, action: string): boolean
  getUserSecurityLevel(user: User): 'low' | 'medium' | 'high' | 'critical' | 'maximum'
}
```

**Separación de Responsabilidades**:
- **UserAuthorizationService**: Métodos universales de autorización
- **Servicios específicos**: Lógica de negocio que USA los métodos universales
- **Controllers**: Solo Commands y Queries (sin lógica)

### 5. Medidas de Seguridad en Servicios
**OBLIGATORIO: Implementar medidas de seguridad en métodos que lo requieran**

Cualquier método en servicios que maneje operaciones sensibles **DEBE** incluir validaciones de seguridad:

```typescript
// ✅ CORRECTO - Método con medidas de seguridad implementadas
async updateAIPersonaStatus(
  id: string,
  isActive: boolean, 
  updatedBy: string,
  currentUser: User,
): Promise<AIPersona> {
  // ✅ Security Measure: Validate user can modify this persona
  await this.validateAIPersonaModification(id, currentUser);
  
  // ✅ Security Measure: Log sensitive operation
  console.log(`User ${currentUser.id.getValue()} changing status of AI Persona ${id} to ${isActive}`);
  
  // Resto de lógica de negocio...
}

// ✅ CORRECTO - Método privado con documentación de seguridad
private async removeAllCompanyAssignments(aiPersonaId: string): Promise<void> {
  // ✅ Security Measure: Only accessible through authorized methods
  // Note: This method is private and can only be called from updateAIPersonaStatus,
  // which already has authorization checks in place.
  
  // Lógica de negocio...
}

// ❌ INCORRECTO - Método sensible sin medidas de seguridad
async updateAIPersonaStatus(id: string, isActive: boolean): Promise<AIPersona> {
  // ❌ No validación de autorización
  // ❌ No logging de operación sensible
  const aiPersona = await this.repository.findById(id);
  aiPersona.updateStatus(isActive);
  return this.repository.update(aiPersona);
}
```

**Operaciones que requieren medidas de seguridad**:
- ✅ Modificación de estados críticos (activar/desactivar)
- ✅ Eliminación de datos
- ✅ Cambios que afectan múltiples entidades
- ✅ Operaciones administrativas
- ✅ Asignación/remoción de permisos o roles

**Medidas de seguridad requeridas**:
1. **Validación de autorización**: Usar `UserAuthorizationService` 
2. **Logging de operaciones**: Documentar operaciones sensibles usando `ILogger`
3. **Validación de entidades**: Verificar existencia y estado
4. **Documentación de seguridad**: Comentar las medidas implementadas

### 6. Uso Obligatorio del Logger Service
**NUNCA usar console.log, console.error, console.warn directamente**

Siempre usar el servicio de logger inyectado para todas las operaciones de logging:

```typescript
// ✅ CORRECTO - Usar ILogger inyectado
@Injectable()
export class AIPersonaService {
  constructor(
    @Inject(LOGGER_SERVICE) private readonly logger: ILogger,
  ) {
    this.logger.setContext(AIPersonaService.name);
  }

  async someMethod(): Promise<void> {
    // ✅ Usar logger service
    this.logger.log('Operation started');
    this.logger.warn('Important business rule applied');
    this.logger.error('Operation failed', error.stack);
    this.logger.debug('Debug information');
  }
}

// ❌ INCORRECTO - Usar console directamente
class SomeService {
  async someMethod(): Promise<void> {
    console.log('Operation started'); // ❌ Prohibido
    console.warn('Warning message'); // ❌ Prohibido
    console.error('Error occurred'); // ❌ Prohibido
  }
}
```

**Beneficios del Logger Service**:
- ✅ Logging centralizado y configurable
- ✅ Niveles de log apropiados (LOG_LEVEL env var)
- ✅ Contexto automático del servicio
- ✅ Integración con sistemas de monitoreo
- ✅ Formato consistente de logs

**Métodos disponibles**:
- `logger.log()` - Información general
- `logger.warn()` - Advertencias y reglas de negocio
- `logger.error()` - Errores con stack trace
- `logger.debug()` - Información de depuración
- `logger.verbose()` - Información detallada

## 🔐 Gestión Obligatoria de Permisos

### Regla Fundamental de Permisos

**OBLIGATORIO**: Todos los permisos nuevos usados en controllers deben ser agregados al archivo `prisma/seed-permissions.ts`.

#### Flujo de Trabajo para Nuevos Permisos

```mermaid
flowchart TD
    A[Agregar decorador @CanRead/@CanWrite/@CanDelete en Controller] --> B[¿Existe el permiso en seed-permissions.ts?]
    B -->|SÍ| C[✅ Continuar desarrollo]
    B -->|NO| D[❌ OBLIGATORIO: Agregar permiso al seed]
    D --> E[Definir permiso con excludeRoles apropiado]
    E --> F[Ejecutar seed para aplicar cambios]
    F --> C
```

#### Estructura de Permisos en Controllers

Los controllers DEBEN usar estos decoradores para control de acceso:

```typescript
// ✅ PATRÓN OBLIGATORIO en Controllers
@CanRead('resource-name')    // Para operaciones GET
@CanWrite('resource-name')   // Para operaciones POST/PUT/PATCH
@CanDelete('resource-name')  // Para operaciones DELETE

// ✅ EJEMPLO: AI Persona Controller
@Get()
@CanRead('ai-persona')  // ← ESTE permiso DEBE existir en seed-permissions.ts
async findAll() { }

@Post()
@CanWrite('ai-persona') // ← ESTE permiso DEBE existir en seed-permissions.ts
async create() { }

@Delete(':id')
@CanDelete('ai-persona') // ← ESTE permiso DEBE existir en seed-permissions.ts
async remove() { }
```

#### Definición de Permisos en Seed

**Ubicación**: `prisma/seed-permissions.ts`

**Estructura obligatoria para cada permiso**:

```typescript
{
  name: 'resource-name:action',           // FORMATO: resource:action
  description: 'Descripción clara del permiso',
  resource: 'resource-name',              // Debe coincidir con @CanAction('resource-name')
  action: 'action',                       // read/write/delete/manage/etc.
  excludeRoles: [configuración_de_roles], // Qué roles NO pueden tener este permiso
}
```

#### Ejemplo Completo: AI Persona Permissions

```typescript
// ✅ EJEMPLO CORRECTO - Permisos AI Persona agregados al seed
{
  name: 'ai-persona:read',
  description: 'Can read AI persona information and configurations',
  resource: 'ai-persona',
  action: 'read',
  excludeRoles: ALLOW_ALL_ROLES, // Todos los roles pueden leer
},
{
  name: 'ai-persona:write',
  description: 'Can create and update AI personas',
  resource: 'ai-persona', 
  action: 'write',
  excludeRoles: [PERMISSION_EXCLUDE_SYMBOLS.ALL_EXCEPT, RolesEnum.ROOT, RolesEnum.ADMIN, RolesEnum.MANAGER],
},
{
  name: 'ai-persona:delete',
  description: 'Can delete AI personas',
  resource: 'ai-persona',
  action: 'delete',
  excludeRoles: [PERMISSION_EXCLUDE_SYMBOLS.ALL_EXCEPT, RolesEnum.ROOT, RolesEnum.ADMIN],
},
```

#### Configuración de ExcludeRoles

**Opciones disponibles para `excludeRoles`**:

```typescript
// ✅ Permitir a todos los roles (incluyendo custom roles)
excludeRoles: ALLOW_ALL_ROLES

// ✅ Solo ROOT y ROOT_READONLY pueden tener este permiso
excludeRoles: [PERMISSION_EXCLUDE_SYMBOLS.ALL_EXCEPT, RolesEnum.ROOT, RolesEnum.ROOT_READONLY]

// ✅ ROOT, ADMIN y MANAGER pueden tener este permiso
excludeRoles: [PERMISSION_EXCLUDE_SYMBOLS.ALL_EXCEPT, RolesEnum.ROOT, RolesEnum.ADMIN, RolesEnum.MANAGER]

// ✅ Excluir solo roles custom (permitir todos los enum roles)
excludeRoles: [PERMISSION_EXCLUDE_SYMBOLS.CUSTOM_ROLES]

// ✅ Excluir solo GUEST
excludeRoles: [RolesEnum.GUEST]
```

#### Jerarquía de Permisos Recomendada

**Para operaciones de lectura** (`read`):
- Generalmente: `ALLOW_ALL_ROLES` (todos pueden leer)
- Información sensible: `[PERMISSION_EXCLUDE_SYMBOLS.ALL_EXCEPT, RolesEnum.ROOT, RolesEnum.ADMIN]`

**Para operaciones de escritura** (`write`):
- Gestión normal: `[PERMISSION_EXCLUDE_SYMBOLS.ALL_EXCEPT, RolesEnum.ROOT, RolesEnum.ADMIN, RolesEnum.MANAGER]`
- Solo administradores: `[PERMISSION_EXCLUDE_SYMBOLS.ALL_EXCEPT, RolesEnum.ROOT, RolesEnum.ADMIN]`

**Para operaciones de eliminación** (`delete`):
- Gestión normal: `[PERMISSION_EXCLUDE_SYMBOLS.ALL_EXCEPT, RolesEnum.ROOT, RolesEnum.ADMIN]`
- Solo ROOT: `[PERMISSION_EXCLUDE_SYMBOLS.ALL_EXCEPT, RolesEnum.ROOT]`

#### Checklist Obligatorio para Nuevos Permisos

- [ ] **Permiso definido** en `prisma/seed-permissions.ts`
- [ ] **Naming consistente**: `resource-name:action` 
- [ ] **Resource coincide** con el usado en `@CanAction('resource-name')`
- [ ] **Descripción clara** de qué permite el permiso
- [ ] **ExcludeRoles apropiado** según la sensibilidad de la operación
- [ ] **Seed ejecutado** para aplicar cambios en la base de datos

#### Reglas de Action Types según Intención del Endpoint

**FUNDAMENTAL**: El decorador de permiso debe reflejar la **intención** real del endpoint, no solo el método HTTP.

**Mapping de Intenciones a Action Types**:

```typescript
// ✅ CORRECTO - Acción específica según intención
@Post()
@CanWrite('ai-persona')    // Crear = write
async create() {}

@Get()
@CanRead('ai-persona')     // Leer = read
async findAll() {}

@Put(':id')
@CanUpdate('ai-persona')   // Actualizar = update (NO write)
async update() {}

@Delete(':id')
@CanDelete('ai-persona')   // Eliminar = delete
async remove() {}

@Post('company/:companyId/assign')
@CanAssign('ai-persona')   // Asignar = assign (NO write)
async assignToCompany() {}

@Post('company/:companyId/unassign')
@CanRemove('ai-persona')   // Desasignar = remove (NO delete)
async unassignFromCompany() {}

@Post(':id/activate')
@CanManage('ai-persona')   // Gestionar estado = manage
async activate() {}
```

**Decoradores de Permisos Disponibles**:

1. **Decoradores de Conveniencia** (recomendados):
```typescript
@CanRead('resource')      // resource:read
@CanWrite('resource')     // resource:write  
@CanUpdate('resource')    // resource:update
@CanDelete('resource')    // resource:delete
@CanAssign('resource')    // resource:assign
@CanRemove('resource')    // resource:remove
@CanManage('resource')    // resource:manage
```

2. **Decorador Literal** (para casos especiales):
```typescript
@RequirePermissions('exact-permission-name')
@RequirePermissions('custom:permission', 'another:permission')  // Múltiples permisos
@RequirePermissions('root:access', 'sensitive:operations')     // Permisos específicos
```

**Cuándo usar cada tipo**:

**✅ Usar decoradores de conveniencia** (90% de casos):
```typescript
// Para operaciones estándar CRUD y patrones comunes
@CanRead('users')         // users:read
@CanUpdate('companies')   // companies:update
@CanAssign('ai-persona')  // ai-persona:assign
```

**✅ Usar @RequirePermissions literal** para:
- Permisos que no siguen el patrón `resource:action`
- Combinaciones complejas de permisos
- Permisos especiales del sistema

```typescript
// Casos especiales que no siguen el patrón estándar
@RequirePermissions('root:access')              // Acceso de root
@RequirePermissions('sensitive:operations')     // Operaciones sensibles
@RequirePermissions('audit:read', 'system:read') // Múltiples permisos específicos
```

**Action Types Disponibles en `ActionType` enum**:
- `READ` - Consultar/leer información
- `WRITE` - Crear nuevos recursos
- `UPDATE` - Modificar recursos existentes
- `DELETE` - Eliminar recursos permanentemente
- `ASSIGN` - Asignar recursos a otros objetos
- `REMOVE` - Desasignar/quitar sin eliminar
- `MANAGE` - Gestionar estado/configuración
- `OPERATIONS` - Operaciones especiales
- `ACCESS` - Acceso a características específicas

**Proceso Obligatorio para Nuevos Action Types**:

1. **Verificar enum**: Revisar si la acción existe en `src/shared/constants/enums.ts`
2. **Agregar al enum** si no existe:
```typescript
export enum ActionType {
  // ... existentes
  NEW_ACTION = 'new_action',  // ✅ Agregar nueva acción
}
```
3. **Crear decorador** en `resource-permissions.decorator.ts`:
```typescript
export const CanNewAction = (resource: string) => RequirePermissions(`${resource}:new_action`);
```
4. **Agregar al seed** en `seed-permissions.ts`:
```typescript
{
  name: 'resource:new_action',
  description: 'Can perform new action on resource',
  resource: 'resource',
  action: 'new_action',
  excludeRoles: [...],
}
```

#### Antipatrones Prohibidos

```typescript
// ❌ PROHIBIDO - Action type incorrecto según intención
@Put(':id')
@CanWrite('ai-persona')    // ❌ PUT debe usar @CanUpdate, no @CanWrite

@Post('assign')
@CanWrite('ai-persona')    // ❌ Asignar debe usar @CanAssign, no @CanWrite

@Post('activate')
@CanUpdate('ai-persona')   // ❌ Activar debe usar @CanManage, no @CanUpdate

// ❌ PROHIBIDO - Usar permiso sin definir en seed
@CanUpdate('new-resource') // Sin definir 'new-resource:update' en seed-permissions.ts

// ❌ PROHIBIDO - Action type no existe en enum
@CanCustomAction('resource') // 'custom_action' no está en ActionType enum

// ❌ PROHIBIDO - Inconsistencia entre controller y seed
@CanUpdate('ai-persona')  // Controller usa 'ai-persona'
// Pero en seed se define como:
{ resource: 'ai_persona' } // ❌ Inconsistente (guión vs underscore)

// ❌ PROHIBIDO - Saltarse el sistema de permisos
@Get()
// Sin @CanRead() ← No hay control de acceso definido

// ❌ PROHIBIDO - Permisos hardcodeados en código
if (user.role === 'admin') { // ❌ Lógica de permisos hardcodeada
  // permitir operación
}
```

#### Beneficios del Sistema Centralizado

- **Consistencia**: Todos los permisos están centralizados y documentados
- **Auditabilidad**: Fácil revisar qué permisos existen y quién los tiene
- **Flexibilidad**: Cambiar permisos sin tocar código de aplicación
- **Escalabilidad**: Fácil agregar nuevos recursos y acciones
- **Seguridad**: Control granular por rol y recurso

## 🚨 Proceso de Decisión de Excepciones

### Flujo de Trabajo Obligatorio

**ANTES** de crear cualquier nueva excepción, seguir este proceso:

```mermaid
flowchart TD
    A[¿Necesito lanzar una excepción?] --> B{¿Existe una excepción común?}
    B -->|SÍ| C[✅ USAR excepción común de domain-exceptions.ts]
    B -->|NO| D{¿Es específica del dominio?}
    D -->|SÍ| E{¿Ya existe en mi dominio?}
    E -->|SÍ| F[✅ USAR excepción existente del dominio]
    E -->|NO| G[✅ CREAR nueva excepción específica]
    D -->|NO| H[❌ CREAR excepción común en domain-exceptions.ts]
    
    C --> I[Implementar con contexto apropiado]
    F --> I
    G --> J[Crear en [domain].exceptions.ts]
    H --> K[Crear en domain-exceptions.ts]
    J --> I
    K --> I
```

### Checklist de Verificación

Antes de crear una nueva excepción, verificar:

- [ ] **¿Es de autorización?** → Usar `InsufficientPermissionsException` o `ForbiddenActionException`
- [ ] **¿Es de autenticación?** → Usar `AuthenticationException`, `InvalidCredentialsException`, etc.
- [ ] **¿Es "entidad no encontrada"?** → Usar `EntityNotFoundException` o crear específica si necesita contexto especial
- [ ] **¿Es "entidad ya existe"?** → Usar `EntityAlreadyExistsException` o crear específica si necesita contexto especial
- [ ] **¿Es validación de input?** → Usar `InvalidInputException` o `InvalidValueObjectException`
- [ ] **¿Es regla de negocio?** → Usar `BusinessRuleValidationException` o crear específica si es compleja
- [ ] **¿Es rate limiting?** → Usar `RateLimitExceededException` o `ThrottlingException`

### Ejemplos de Decisiones Correctas

```typescript
// ✅ CORRECTO - Reutilizar común
// Caso: Usuario no tiene permisos para eliminar AI Persona
throw new InsufficientPermissionsException('delete_ai_persona', 'AI Persona');

// ✅ CORRECTO - Específica del dominio 
// Caso: Intentar modificar AI Persona por defecto sin ser root
throw new CannotModifyDefaultAIPersonaException();

// ✅ CORRECTO - Específica con contexto único
// Caso: Error específico de negocio con información detallada
throw new AIPersonaKeyNameAlreadyExistsException(keyName, companyId);

// ❌ INCORRECTO - Duplicar común innecesariamente
throw new AIPersonaNotFoundForUserException(id, userId); 
// ↳ Mejor usar: EntityNotFoundException('AI Persona', id)

// ❌ INCORRECTO - Crear específica para caso común
throw new AIPersonaAccessDeniedException(userId, aiPersonaId);
// ↳ Mejor usar: ForbiddenActionException('Access to AI Persona denied', 'access', aiPersonaId)
```

### Naming Conventions para Excepciones

```typescript
// ✅ CORRECTO - Nombres descriptivos
CannotModifyDefaultAIPersonaException  // Acción + restricción específica
AIPersonaKeyNameAlreadyExistsException // Entidad + campo + condición
UserNotEligibleForRoleException        // Sujeto + restricción + objeto

// ❌ INCORRECTO - Nombres genéricos que duplican comunes
AIPersonaNotFoundException             // Mejor: EntityNotFoundException
AIPersonaForbiddenException           // Mejor: ForbiddenActionException  
AIPersonaPermissionException          // Mejor: InsufficientPermissionsException
```

## 🛠️ Proceso Obligatorio Post-Desarrollo

### Ejecución de Linter
**SIEMPRE ejecutar ESLint después de completar cualquier cambio de código**:

```bash
# Ejecutar ESLint con auto-corrección
npm run lint

# Si el comando anterior no existe, usar directamente:
npx eslint . --fix
```

**¿Por qué es obligatorio?**
- ✅ Corrige automáticamente indentación
- ✅ Ajusta saltos de línea y espaciado
- ✅ Aplica formato consistente del proyecto
- ✅ Detecta errores de sintaxis
- ✅ Asegura adherencia a las reglas del proyecto

**Cuándo ejecutar**:
1. **Después de cualquier cambio de código** (nuevo archivo, modificación, refactoring)
2. **Antes de hacer commit** a Git
3. **Después de resolver conflictos de merge**
4. **Al completar una feature completa**

**Integración con el flujo de trabajo**:
```bash
# Flujo típico de desarrollo
1. Hacer cambios de código
2. npm run lint          # ← OBLIGATORIO
3. npm run test          # Verificar tests
4. git add .
5. git commit -m "..."
```

**Nota**: El linter puede modificar archivos automáticamente. Siempre revisar los cambios antes del commit.

---

*Esta guía está basada en la implementación real del proyecto y debe mantenerse actualizada con los cambios arquitecturales.*