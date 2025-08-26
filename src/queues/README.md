# Queue System

Sistema de colas robusto basado en NestJS + CQRS + BullMQ para el proyecto nauto-console-backend.

## Características

- **Arquitectura de 3 procesos**: API, Worker, o Both
- **Health Monitoring**: Monitoreo continuo de las colas con admission control
- **Event Registry**: Sistema de decoradores para registro automático de eventos
- **Infinite Retry**: Reintentos infinitos con límite temporal de 6 horas
- **CQRS Integration**: Totalmente integrado con el patrón CQRS existente
- **Clean Architecture**: Respeta la estructura Clean Architecture del proyecto

## Estructura

```
src/queues/
├── base/                    # Clases base abstraactas
│   ├── base-event-bus.ts   # Event bus base con health checks
│   └── base-processor.ts   # Processor base con manejo de errores
├── config/                 # Configuraciones
│   └── queue.config.ts     # Configuración Redis/BullMQ
├── controllers/            # Controladores REST
│   └── queue-health.controller.ts
├── event-bus/              # Event buses específicos
│   └── generic-event-bus.ts
├── examples/               # Ejemplos de uso
│   ├── events/
│   │   └── user.events.ts  # Eventos de ejemplo
│   └── event-handlers/
│       └── user-created.handler.ts
├── health/                 # Sistema de salud
│   └── health-checker.service.ts
├── registry/               # Registro de eventos
│   └── event-registry.ts   # Decoradores y registry
├── types/                  # Interfaces y tipos
│   └── index.ts
├── validation/             # Validación de eventos
│   └── event-validation.ts
├── queue.module.ts         # Módulo principal
├── index.ts               # Exports principales
└── README.md
```

## Configuración

### Variables de Entorno

Agrega estas variables a tu `.env`:

```bash
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
REDIS_USER=
REDIS_PASSWORD=
REDIS_TLS=false
REDIS_TLS_REJECT_UNAUTHORIZED=true
REDIS_TLS_SERVERNAME=

# BullMQ Configuration
BULLMQ_PREFIX=nauto:queues

# Performance Configuration
HEALTH_CHECK_INTERVAL_MS=2000
BQ_MAX_BACKLOG=5000
BQ_MAX_ACTIVE=200
REDIS_MAX_FILL_PCT=0.85
REDIS_MAX_USED_MB=2048
EVENT_MAX_BYTES=262144

# Events Configuration
DEFAULT_QUEUE_NAME=events
RETRY_WINDOW_HOURS=6
Q_EVENTS_CONCURRENCY=10
Q_JOB_ATTEMPTS=5
Q_JOB_BACKOFF_DELAY=5000

# Streams Configuration
QUEUE_EVENTS_STREAM_MAXLEN=10000
QUEUE_EVENTS_STREAM_APPROX=true
```

## Uso Básico

### 1. Crear un Evento

```typescript
import { MQSerializableEvent } from '@queues/registry/event-registry';

@MQSerializableEvent('UserCreated')
export class UserCreatedEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly timestamp: Date = new Date(),
  ) {}

  static fromJSON(data: any): UserCreatedEvent {
    return new UserCreatedEvent(
      data.userId,
      data.email,
      new Date(data.timestamp),
    );
  }
}
```

### 2. Crear un Handler

```typescript
import { Injectable } from '@nestjs/common';
import { EventHandler } from '@queues/types';
import { MQSerializableEventHandler } from '@queues/registry/event-registry';
import { UserCreatedEvent } from './user-created.event';

@Injectable()
@MQSerializableEventHandler(UserCreatedEvent)
export class UserCreatedHandler implements EventHandler {
  async handle(event: UserCreatedEvent): Promise<void> {
    console.log(`Processing user creation: ${event.userId}`);
    // Tu lógica aquí
  }
}
```

### 3. Publicar Eventos

```typescript
import { Injectable } from '@nestjs/common';
import { GenericEventBus } from '@queues/event-bus/generic-event-bus';

@Injectable()
export class UserService {
  constructor(private readonly eventBus: GenericEventBus) {}

  async createUser(userData: any) {
    // Crear usuario...
    
    // Publicar evento
    const event = new UserCreatedEvent(user.id, user.email);
    await this.eventBus.publishEvent(event);
  }
}
```

## Modos de Proceso

### API Process (Solo publicación)
```typescript
QueueModule.forApiProcess()
```

### Worker Process (Solo procesamiento)
```typescript
QueueModule.forWorkerProcess([UserCreatedHandler])
```

### Both Processes (Publicación + Procesamiento)
```typescript
QueueModule.forBothProcesses()
```

## Health Endpoints

### Verificar salud de las colas
```bash
GET /queue/health
GET /queue/health?queue=events
```

### Listar colas registradas
```bash
GET /queue/health/queues
```

## Integración con Clean Architecture

El sistema está diseñado para integrarse perfectamente con la arquitectura existente:

- **Eventos de Dominio**: Se pueden decorar con `@MQSerializableEvent`
- **Handlers en Application**: Van en `src/application/events/`
- **Publicación en Controllers**: Usar `GenericEventBus` en controllers
- **Configuración en Infrastructure**: Configuración centralizada

## Ejemplo de Integración

```typescript
// src/core/events/user.events.ts
@MQSerializableEvent('UserCreated')
export class UserCreatedEvent extends DomainEvent {
  // ...
}

// src/application/events/user-created.handler.ts
@Injectable()
@MQSerializableEventHandler(UserCreatedEvent)
export class UserCreatedHandler implements EventHandler {
  // ...
}

// src/presentation/controllers/user.controller.ts
@Controller('users')
export class UserController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly eventBus: GenericEventBus,
  ) {}

  @Post()
  async createUser(@Body() dto: CreateUserDto) {
    const result = await this.commandBus.execute(new CreateUserCommand(dto));
    
    // Publicar evento async
    const event = new UserCreatedEvent(result.id, result.email);
    await this.eventBus.publishEvent(event);
    
    return result;
  }
}
```

## Monitoreo

El sistema incluye monitoreo automático que verifica:

- **Backlog de cola**: Límite configurable
- **Trabajos activos**: Límite configurable  
- **Salud de Redis**: Memoria y latencia
- **Admission Control**: Rechaza eventos cuando está sobrecargado

## Dependencias Agregadas

Las siguientes dependencias se agregaron automáticamente al `package.json`:

```json
{
  "dependencies": {
    "@nestjs/bullmq": "^10.2.1",
    "bullmq": "^5.28.5",
    "redis": "^4.7.0"
  }
}
```

Para instalarlas ejecuta:

```bash
npm install
```

## Próximos Pasos

1. Instalar las dependencias: `npm install`
2. Configurar las variables de entorno
3. Levantar Redis: `docker run -p 6379:6379 redis:alpine`
4. Crear tus eventos y handlers siguiendo los ejemplos
5. Probar los endpoints de salud: `GET /queue/health`