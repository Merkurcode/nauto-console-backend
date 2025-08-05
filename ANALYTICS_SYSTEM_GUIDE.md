# Sistema de Análisis y Citas Empresarial

## Resumen General

Este sistema implementa una solución completa de gestión de citas con análisis avanzado, optimizado para manejar millones de registros de manera eficiente. El sistema está construido siguiendo los principios de Clean Architecture, DDD y CQRS.

## Arquitectura del Sistema

### Componentes Principales

1. **Universal KPI Engine** - Motor de cálculo de métricas
2. **Appointment Analytics Service** - Gestión de citas con auditoría
3. **KPI Management Service** - Configuración de indicadores
4. **Analytics Jobs Service** - Trabajos automáticos de mantenimiento

## Funcionalidades Clave

### 1. Gestión de Citas (Appointments)

#### Características:
- **Sin campo endDateTime**: Se calcula automáticamente como `startDateTime + estimatedDuration`
- **Auditoría universal**: Cada cambio se registra automáticamente
- **Historial completo**: Preserva datos históricos sin cascadas de eliminación
- **Reagendamiento inteligente**: Crea nueva cita vinculada a la original
- **Recordatorios**: Array de strings para eventos procesados (`reminderEvents: string[]`)

#### Flujo de Trabajo:
```typescript
// Crear cita
const appointment = await appointmentAnalytics.createAppointment({
  title: "Consulta médica",
  startDateTime: new Date("2024-01-15T10:00:00Z"),
  estimatedDuration: 60,
  companyId: "company-123",
  employeeId: "doctor-456",
  // ... otros campos
}, context);

// Actualizar estado
await appointmentAnalytics.updateAppointment(appointmentId, {
  status: "CONFIRMED",
  actualDuration: 65
}, context);

// Reagendar
await appointmentAnalytics.rescheduleAppointment(
  appointmentId,
  new Date("2024-01-16T14:00:00Z"),
  "doctor-789"
);
```

### 2. Sistema de Auditoría Universal

#### Funciona Automáticamente:
- Captura **TODOS** los cambios en las entidades
- Registra contexto completo (usuario, sesión, IP, etc.)
- Calcula campos derivados (mes, año, trimestre, semana)
- Asigna puntaje de impacto automáticamente

#### Particionado Inteligente:
```sql
-- Particiones mensuales automáticas
audit_log_2024_01, audit_log_2024_02, etc.
-- Mejora consultas hasta 10x más rápidas
```

### 3. Motor de KPIs (Key Performance Indicators)

#### KPIs Predefinidos:
1. **Tasa de Conversión** (`appointment_conversion_rate`)
   - % de citas completadas vs confirmadas
2. **Tasa de Inasistencia** (`appointment_no_show_rate`)
   - % de clientes que no asistieron
3. **Duración Promedio** (`appointment_avg_duration`)
   - Tiempo real promedio de citas
4. **Tasa de Reagendamiento** (`appointment_reschedule_rate`)
   - % de citas reagendadas

#### Cálculo Automático:
- **Tiempo real**: Cada 5 minutos para KPIs críticos
- **Diario**: Cálculos a las 2:00 AM
- **Semanal**: Domingos a las 3:00 AM
- **Mensual**: Primer día del mes a las 4:00 AM

### 4. Estrategia de Rendimiento de 3 Niveles

#### Nivel 1: Cache (< 50ms)
```typescript
// Consultas frecuentes se guardan en cache
const metrics = await kpiEngine.calculateComplexMetrics(query);
// Si existe en cache, respuesta inmediata
```

#### Nivel 2: Pre-calculados (< 200ms)
```typescript
// Valores ya calculados en KPIValue
const preCalculated = await queryPreCalculated(query);
```

#### Nivel 3: Consulta Optimizada (< 2000ms)
```typescript
// Query con poda de particiones
const result = await queryWithPartitionPruning(query);
```

## Casos de Uso Principales

### 1. Dashboard de Métricas
```typescript
GET /analytics/metrics/dashboard/company-123?period=last30days
```
**Retorna**: Métricas agregadas por día/semana/mes con tasas de conversión, inasistencia, etc.

### 2. Análisis Complejo
```typescript
POST /analytics/metrics/complex
{
  "companyId": "company-123",
  "startDate": "2024-01-01",
  "endDate": "2024-01-31",
  "groupBy": "week",
  "conditions": [
    {
      "field": "(after_data->>'status')",
      "operator": "IN",
      "value": ["COMPLETED", "CANCELLED"]
    }
  ]
}
```
**Retorna**: Análisis detallado con condiciones X, Y, Z personalizadas.

### 3. Análisis de Rendimiento por Empleado
```typescript
POST /analytics/examples/employee-performance
{
  "companyId": "company-123",
  "employeeId": "doctor-456",
  "startDate": "2024-01-01",
  "endDate": "2024-01-31"
}
```

## Optimizaciones para Millones de Registros

### 1. Particionado por Fecha
- **Particiones mensuales** en PostgreSQL
- **Poda automática** de particiones irrelevantes
- **Compresión** de particiones antiguas

### 2. Índices Estratégicos
```sql
-- Índices optimizados para consultas frecuentes
CREATE INDEX idx_audit_company_date ON universal_audit_log(company_id, event_date);
CREATE INDEX idx_appointments_employee_date ON appointments(employee_id, start_date_time);
```

### 3. Cache Inteligente
- **TTL dinámico**: 1 hora para datos frecuentes
- **Invalidación automática**: Al cambiar datos fuente
- **Estadísticas de uso**: Para optimizar cache hits

### 4. Jobs de Mantenimiento
- **Archivado automático**: Registros > 2 años a archivo comprimido
- **Limpieza de cache**: Elimina entradas expiradas
- **Creación de particiones**: Genera particiones futuras
- **Compresión**: Particiones > 3 meses se comprimen

## Estructura de Base de Datos

### Modelos Principales:
```prisma
model Appointments {
  id: String // UUID
  title: String
  startDateTime: DateTime
  estimatedDuration: Int // minutos
  actualDuration: Int? // calculado al completar
  status: AppointmentStatus
  reminderEvents: String[] // eventos procesados
  // ... campos desnormalizados para rendimiento
}

model UniversalAuditLog {
  entityType: String
  operation: String
  beforeData: Json?
  afterData: Json
  eventDate: DateTime // para particionado
  // ... campos calculados automáticamente
}

model KPIConfiguration {
  kpiCode: String @unique
  calculationQuery: String // SQL personalizada
  aggregationPeriods: String[] // DAILY, WEEKLY, MONTHLY
  isRealTime: Boolean
}
```

## API Endpoints Principales

### Gestión de Citas
- `POST /analytics/appointments` - Crear cita
- `PUT /analytics/appointments/{id}` - Actualizar cita
- `POST /analytics/appointments/{id}/reschedule` - Reagendar
- `GET /analytics/appointments/{id}/history` - Historial completo

### Métricas y Análisis
- `GET /analytics/metrics/dashboard/{companyId}` - Dashboard
- `POST /analytics/metrics/complex` - Consultas complejas
- `POST /analytics/metrics/appointments` - Métricas de citas

### Configuración de KPIs
- `POST /analytics/kpis` - Crear KPI personalizado
- `GET /analytics/kpis/{kpiCode}` - Obtener configuración
- `POST /analytics/kpis/{kpiCode}/calculate` - Calcular manualmente

### Administración
- `POST /analytics/admin/setup-kpis` - Instalar KPIs predefinidos
- `POST /analytics/admin/maintenance` - Ejecutar mantenimiento
- `POST /analytics/admin/recalculate/{companyId}` - Recalcular empresa

## Configuración y Deployment

### 1. Setup Inicial
```bash
# Generar cliente Prisma
npm run db:generate

# Ejecutar migraciones
npm run db:migrate

# Crear particiones PostgreSQL
psql -d database -f scripts/setup-partitioning.sql

# Instalar KPIs predefinidos
POST /analytics/admin/setup-kpis
```

### 2. Variables de Entorno
```env
DATABASE_URL="postgresql://..."
REDIS_URL="redis://..." # Para cache (opcional)
```

### 3. Monitoreo
- **Logs estructurados** con contexto de rendimiento
- **Métricas de cache hit/miss**
- **Alertas automáticas** para KPIs críticos
- **Estadísticas de particiones**

## Ejemplo de Flujo Completo

### Escenario: Clínica médica con 1M+ citas anuales

1. **Crear cita**:
   ```typescript
   const cita = await appointmentAnalytics.createAppointment({
     title: "Consulta General",
     startDateTime: new Date("2024-01-15T10:00:00Z"),
     estimatedDuration: 30,
     companyId: "clinica-abc",
     employeeId: "dr-garcia",
     clientName: "Juan Pérez",
     eventTypeName: "Consulta General"
   }, context);
   ```

2. **Auditoría automática**: Se crea entrada en `UniversalAuditLog`

3. **Cliente confirma**: 
   ```typescript
   await appointmentAnalytics.updateAppointment(cita.id, {
     status: "CONFIRMED"
   }, context);
   ```

4. **Cálculo KPI automático**: Cada 5 minutos actualiza tasas en tiempo real

5. **Consultar métricas**:
   ```typescript
   const dashboard = await GET("/analytics/metrics/dashboard/clinica-abc?period=last30days");
   // Retorna: conversion_rate: 85%, no_show_rate: 12%, etc.
   ```

6. **Mantenimiento nocturno**: Automático a las 2 AM
   - Calcula KPIs diarios
   - Archiva registros antiguos  
   - Limpia cache expirado
   - Crea particiones futuras

## Beneficios del Sistema

### Para Desarrolladores
- **Type-safe**: Interfaces TypeScript completas
- **Escalable**: Optimizado para millones de registros
- **Mantenible**: Clean Architecture + CQRS
- **Testeable**: Mocks y abstracciones claras

### Para el Negocio
- **Insights automáticos**: KPIs calculados sin intervención
- **Historial completo**: Nunca se pierde información
- **Rendimiento**: Respuestas < 2 segundos incluso con millones de registros
- **Flexibilidad**: Consultas personalizadas X, Y, Z conditions

### Para Usuarios Finales
- **Dashboards rápidos**: Métricas en tiempo real
- **Reportes detallados**: Análisis por empleado, período, tipo
- **Alertas automáticas**: Notificaciones de tendencias negativas
- **Datos confiables**: Auditoría completa de todos los cambios

## Próximos Pasos Recomendados

1. **Testing**: Implementar tests unitarios e integración
2. **Documentación API**: Swagger/OpenAPI completo
3. **Optimizaciones**: Índices adicionales basados en uso real
4. **Alerting**: Sistema de notificaciones para KPIs críticos
5. **Machine Learning**: Predicción de no-shows y optimización de horarios

---

*Sistema desarrollado siguiendo mejores prácticas de Clean Architecture, optimizado para alta disponibilidad y rendimiento empresarial.*