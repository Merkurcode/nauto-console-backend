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
├── 📁 mappers/          # Transformación entre capas
└── 📁 _responses/       # Interfaces de respuesta
```

**Reglas**:
- ✅ Implementa casos de uso específicos
- ✅ Coordina entre dominio e infraestructura
- ✅ Maneja transacciones
- ❌ NO contiene lógica de negocio

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

### 4. Presentation Layer (`src/presentation/`)

**Propósito**: Maneja la interacción con el mundo exterior.

```typescript
📁 presentation/
├── 📁 modules/          # Módulos de NestJS
├── 📁 controllers/      # Controllers REST/GraphQL
├── 📁 guards/          # Guards de autenticación/autorización
├── 📁 interceptors/    # Interceptores
├── 📁 filters/         # Exception filters
└── 📁 middleware/      # Middleware personalizado
```

**Reglas**:
- ✅ Punto de entrada HTTP/GraphQL
- ✅ Validación de entrada
- ✅ Transformación de respuestas
- ❌ NO contiene lógica de negocio

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

```typescript
// Command Handler
@CommandHandler(CreateUserActivityLogCommand)
export class CreateUserActivityLogCommandHandler {
  constructor(
    @Inject(USER_ACTIVITY_LOG_REPOSITORY)
    private readonly repository: IUserActivityLogRepository,
  ) {}

  async execute(command: CreateUserActivityLogCommand): Promise<void> {
    // 1. Crear entidad usando factory
    const userActivityLog = UserActivityLog.create({
      userId: UserId.fromString(command.userId),
      activityType: UserActivityType.create(command.activityType),
      action: command.action,
      description: command.description,
      impact: UserActivityImpact.create(command.impact),
    });

    // 2. Persistir usando repositorio
    await this.repository.save(userActivityLog);

    // 3. Los eventos se publican automáticamente via AggregateRoot
  }
}
```

### Query Pattern (Read Operations)

```typescript
// Query Handler
@QueryHandler(GetUserActivityLogsQuery)
export class GetUserActivityLogsQueryHandler {
  constructor(
    private readonly userActivityLogService: UserActivityLogService,
  ) {}

  async execute(query: GetUserActivityLogsQuery): Promise<IUserActivityLogPaginatedResponse> {
    // 1. Validar autorización en el service
    const { logs, total } = await this.userActivityLogService.validateAndGetActivityLogs(
      query.currentUserId,
      query.targetUserId,
      query.accessType,
      query.filters,
    );

    // 2. Mapear a response
    return UserActivityLogMapper.toPaginatedResponse(logs, total, query.page, query.limit);
  }
}
```

### Reglas CQRS

1. **Separación**: Commands modifican estado, Queries solo leen
2. **Handlers**: Un handler por command/query
3. **DTOs**: Diferentes DTOs para commands y queries
4. **Validation**: En el comando/query, no en el handler
5. **Transactions**: Solo en commands, nunca en queries

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
export interface IUserActivityLogRepository {
  save(userActivityLog: UserActivityLog): Promise<UserActivityLog>;
  findById(id: string): Promise<UserActivityLog | null>;
  findByUserId(userId: UserId, filters?: IFilters): Promise<UserActivityLog[]>;
  findAll(filters?: IFilters): Promise<UserActivityLog[]>;
  countByUserId(userId: UserId, filters?: IFilters): Promise<number>;
  countAll(filters?: IFilters): Promise<number>;
  delete(id: string): Promise<void>;
}
```

### Implementación en Infraestructura

```typescript
// En src/infrastructure/repositories/
@Injectable()
export class UserActivityLogRepository implements IUserActivityLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(userActivityLog: UserActivityLog): Promise<UserActivityLog> {
    const data = UserActivityLogMapper.toPersistence(userActivityLog);
    
    const saved = await this.prisma.userActivityLog.upsert({
      where: { id: userActivityLog.id },
      update: data as Prisma.UserActivityLogUncheckedUpdateInput,
      create: data as Prisma.UserActivityLogUncheckedCreateInput,
    });

    return UserActivityLogMapper.toDomain(saved);
  }
}
```

### Reglas de Repositorio

1. **Interface en Dominio**: Define el contrato
2. **Implementación en Infraestructura**: Usa Prisma u ORM
3. **Mappers**: Para transformar entre dominio y persistencia
4. **Filtering**: Usar interfaces específicas para filtros
5. **Transactions**: Soportar contexto transaccional

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

```typescript
// src/core/exceptions/domain-exceptions.ts
export class UserActivityLogNotFoundException extends Error {
  constructor(id: string) {
    super(`UserActivityLog with id ${id} not found`);
    this.name = 'UserActivityLogNotFoundException';
  }
}

export class InvalidActivityTypeException extends Error {
  constructor(activityType: string) {
    super(`Invalid activity type: ${activityType}`);
    this.name = 'InvalidActivityTypeException';
  }
}
```

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

```typescript
// ✅ Correcto - Module bien estructurado
@Module({
  imports: [CqrsModule, CoreModule],  // ✅ Dependencies
  controllers: [UserActivityLogController],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
    // No services here - they're in CoreModule
  ],
  exports: [...CommandHandlers, ...QueryHandlers],
})
export class UserActivityLogModule {}
```

## 📏 Code Style Rules

### 1. Naming Conventions

- **Entities**: PascalCase (`UserActivityLog`)
- **Value Objects**: PascalCase + `.vo.ts` (`Email.vo.ts`)
- **Events**: PascalCase + Event suffix (`UserCreatedEvent`)
- **Interfaces**: PascalCase + `I` prefix (`IUserRepository`)
- **Constants**: SCREAMING_SNAKE_CASE (`USER_REPOSITORY`)

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

- [ ] **Entity** sigue el patrón (campos privados, constructor privado, factory methods)
- [ ] **Value Objects** para tipos complejos
- [ ] **Events** se emiten en operaciones importantes
- [ ] **Repository Interface** en dominio, implementación en infraestructura
- [ ] **Commands** para writes, **Queries** para reads
- [ ] **Service** en dominio para lógica de negocio
- [ ] **Transactions** en controllers para writes
- [ ] **DTOs** para entrada y salida
- [ ] **Mappers** para transformaciones
- [ ] **Module** bien configurado con dependencias
- [ ] **Tests** para cada capa
- [ ] **Error Handling** con excepciones específicas

## 📚 Referencias Implementadas

- **UserActivityLog**: Ejemplo completo de entidad con eventos y versionado
- **User**: Entidad compleja con múltiples value objects
- **CQRS**: Separación completa de commands y queries
- **Events**: Sistema robusto de eventos de dominio
- **Repositories**: Patrón completo con interfaces y implementaciones
- **Modules**: Organización limpia con inyección de dependencias

---

*Esta guía está basada en la implementación real del proyecto y debe mantenerse actualizada con los cambios arquitecturales.*