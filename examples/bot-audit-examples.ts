/**
 * EJEMPLOS COMPLETOS: Sistema de Auditoría BOT
 * 
 * Muestra cómo se registran y consultan los logs de actividad BOT
 * tanto en archivos de log como en base de datos.
 */

// ================================================================================================
// 1. EJEMPLO DE LOG EN ARCHIVO (application.log)
// ================================================================================================
const logFileExample = {
  level: 'warn',
  timestamp: '2025-08-07T10:30:15.123Z',
  context: 'BotAuditInterceptor',
  event: 'BOT_REQUEST_SUCCESS',
  requestId: 'bot_req_1691424015123_abc12def34',
  
  // Información del BOT
  botInfo: {
    userId: 'chatbot-external-001',
    email: 'chatbot@company.com',
    tokenId: 'bot_1691424000_abc123def456',
  },

  // Request information
  request: {
    method: 'POST',
    path: '/users',
    query: { limit: 10, offset: 0 },
    params: { companyId: '550e8400-e29b-41d4-a716-446655440000' },
  },

  // Response information
  response: {
    statusCode: 201,
    statusMessage: 'Created',
    contentLength: '1024',
    data: {
      _truncated: true,
      _originalSize: 2048,
      _type: 'object',
    }
  },

  // Performance metrics
  performance: {
    duration: '150ms',
    startTime: 1691424015123,
    endTime: 1691424015273,
  }
};

// ================================================================================================
// 2. EJEMPLO DE ENTRADA EN BASE DE DATOS (audit_logs table)
// ================================================================================================
const databaseLogExample = {
  id: 'audit-log-uuid-12345',
  level: 'info',
  type: 'bot',
  action: 'BOT_REQUEST_SUCCESS',
  message: 'BOT Activity: BOT_REQUEST_SUCCESS on POST /users',
  userId: 'chatbot-external-001',
  context: 'bot',
  timestamp: '2025-08-07T10:30:15.123Z',
  
  // Metadata JSON field (almacenado como JSONB en PostgreSQL)
  metadata: {
    // Identificación BOT
    botActivity: true,
    botType: 'external-chatbot',
    tokenId: 'bot_1691424000_abc123def456',
    requestId: 'bot_req_1691424015123_abc12def34',
    
    // Request details
    method: 'POST',
    path: '/users',
    resource: 'POST /users',
    query: { limit: 10, offset: 0 },
    params: { companyId: '550e8400-e29b-41d4-a716-446655440000' },
    body: {
      name: 'New User',
      email: 'user@example.com',
      password: '[REDACTED]'
    },
    
    // Response details
    statusCode: 201,
    duration: '150ms',
    responseSize: '1024',
    
    // Network info
    ipAddress: '192.168.1.100',
    userAgent: 'ChatbotClient/1.0',
    
    // Context
    companyId: '550e8400-e29b-41d4-a716-446655440000',
    tenantId: '550e8400-e29b-41d4-a716-446655440000',
    application: 'nauto-console-backend',
    timestamp: '2025-08-07T10:30:15.123Z',
  },
  
  createdAt: '2025-08-07T10:30:15.123Z',
  updatedAt: '2025-08-07T10:30:15.123Z'
};

// ================================================================================================
// 3. CONSULTA DE LOGS BOT VIA API
// ================================================================================================
const queryBotLogsExample = {
  // Request
  endpoint: 'GET /bot-audit/activity',
  headers: {
    'Authorization': 'Bearer <root-token>',
    'Content-Type': 'application/json'
  },
  query: {
    botUserId: 'chatbot-external-001',
    fromDate: '2025-08-07T00:00:00Z',
    toDate: '2025-08-07T23:59:59Z',
    method: 'POST',
    statusCode: 201,
    limit: 50
  },
  
  // Response
  response: {
    logs: [
      {
        id: 'audit-log-uuid-12345',
        timestamp: '2025-08-07T10:30:15.123Z',
        action: 'BOT_REQUEST_SUCCESS',
        resource: 'POST /users',
        method: 'POST',
        path: '/users',
        statusCode: 201,
        duration: '150ms',
        botUserId: 'chatbot-external-001',
        tokenId: 'bot_1691424000_abc123def456',
        companyId: '550e8400-e29b-41d4-a716-446655440000',
        ipAddress: '192.168.1.100',
        userAgent: 'ChatbotClient/1.0',
        requestId: 'bot_req_1691424015123_abc12def34',
        query: { limit: 10, offset: 0 },
        params: { companyId: '550e8400-e29b-41d4-a716-446655440000' }
      }
    ],
    total: 1,
    filters: {
      botUserId: 'chatbot-external-001',
      fromDate: '2025-08-07T00:00:00Z',
      toDate: '2025-08-07T23:59:59Z',
      method: 'POST',
      statusCode: 201,
      limit: 50,
      appliedBy: 'root-user-id',
      appliedAt: '2025-08-07T11:00:00Z'
    }
  }
};

// ================================================================================================
// 4. ESTADÍSTICAS DE ACTIVIDAD BOT
// ================================================================================================
const botStatisticsExample = {
  // Request
  endpoint: 'GET /bot-audit/statistics',
  query: {
    fromDate: '2025-08-07T00:00:00Z',
    toDate: '2025-08-07T23:59:59Z'
  },
  
  // Response
  response: {
    general: {
      // Estadísticas generales del audit log
      totalLogs: 1250,
      logsByType: {
        auth: 125,
        security: 25,
        bot: 1000, // ← Logs específicos de BOT
        api: 100
      }
    },
    
    botSpecific: {
      totalRequests: 1000,
      successfulRequests: 950, // 95% success rate
      errorRequests: 50,       // 5% error rate
      
      methodBreakdown: {
        'GET': 600,
        'POST': 300,
        'PUT': 80,
        'DELETE': 20
      },
      
      statusCodeBreakdown: {
        '200': 600,
        '201': 280,
        '204': 70,
        '400': 30,
        '404': 15,
        '500': 5
      },
      
      averageResponseTime: '125ms',
      
      topEndpoints: [
        { endpoint: 'GET /users', count: 400 },
        { endpoint: 'POST /conversations', count: 200 },
        { endpoint: 'GET /companies', count: 150 },
        { endpoint: 'POST /users', count: 100 },
        { endpoint: 'GET /files', count: 80 }
      ],
      
      uniqueTokens: 3, // Número de tokens BOT diferentes usados
      
      dateRange: {
        from: '2025-08-07T00:00:00Z',
        to: '2025-08-07T23:59:59Z'
      }
    },
    
    generatedBy: 'root-user-id',
    generatedAt: '2025-08-07T11:00:00Z'
  }
};

// ================================================================================================
// 5. CONSULTAS SQL DIRECTAS A LA BASE DE DATOS
// ================================================================================================
const sqlQueriesExamples = {
  // Todos los logs BOT del último día
  allBotLogsToday: `
    SELECT * FROM audit_logs 
    WHERE type = 'bot' 
    AND timestamp >= NOW() - INTERVAL '1 day'
    ORDER BY timestamp DESC;
  `,
  
  // Logs BOT por token específico
  logsByToken: `
    SELECT 
      timestamp,
      action,
      metadata->>'method' as method,
      metadata->>'path' as path,
      metadata->>'statusCode' as status_code,
      metadata->>'duration' as duration
    FROM audit_logs 
    WHERE type = 'bot' 
    AND metadata->>'tokenId' = 'bot_1691424000_abc123def456'
    ORDER BY timestamp DESC;
  `,
  
  // Estadísticas de rendimiento BOT
  performanceStats: `
    SELECT 
      metadata->>'method' as method,
      COUNT(*) as total_requests,
      AVG(CAST(REPLACE(metadata->>'duration', 'ms', '') AS INTEGER)) as avg_response_time,
      COUNT(CASE WHEN CAST(metadata->>'statusCode' AS INTEGER) >= 400 THEN 1 END) as error_count
    FROM audit_logs 
    WHERE type = 'bot' 
    AND metadata->>'duration' IS NOT NULL
    GROUP BY metadata->>'method'
    ORDER BY total_requests DESC;
  `,
  
  // Top endpoints accedidos por BOT
  topEndpoints: `
    SELECT 
      CONCAT(metadata->>'method', ' ', metadata->>'path') as endpoint,
      COUNT(*) as access_count,
      AVG(CAST(REPLACE(metadata->>'duration', 'ms', '') AS INTEGER)) as avg_response_time
    FROM audit_logs 
    WHERE type = 'bot' 
    AND timestamp >= NOW() - INTERVAL '7 days'
    GROUP BY endpoint
    ORDER BY access_count DESC
    LIMIT 10;
  `,
  
  // Logs de errores BOT
  botErrors: `
    SELECT 
      timestamp,
      metadata->>'tokenId' as token_id,
      metadata->>'method' as method,
      metadata->>'path' as path,
      metadata->>'statusCode' as status_code,
      metadata->>'error'->>'message' as error_message
    FROM audit_logs 
    WHERE type = 'bot' 
    AND CAST(metadata->>'statusCode' AS INTEGER) >= 400
    ORDER BY timestamp DESC;
  `
};

// ================================================================================================
// 6. CONFIGURACIÓN DE MAIN.TS PARA HABILITAR AUDITORÍA BOT
// ================================================================================================
const mainTsConfig = `
// main.ts - Configuración completa
import { BotAuditInterceptor } from './src/presentation/interceptors/bot-audit.interceptor';
import { BotOptimizationGuard } from './src/presentation/guards/bot-optimization.guard';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Guards en orden correcto
  app.useGlobalGuards(
    new JwtAuthGuard(reflector),
    new BotOptimizationGuard(reflector), // ← Detecta requests BOT
    new ThrottlerGuard(reflector, throttlerService, configService),
    new PermissionsGuard(reflector, userAuthService),
    // otros guards...
  );
  
  // Interceptors para auditoría
  app.useGlobalInterceptors(
    new BotAuditInterceptor(loggerService, auditLogService) // ← Audita BOT
  );
  
  await app.listen(3001);
}
`;

// ================================================================================================
// 7. EJEMPLO DE MONITOREO Y ALERTAS
// ================================================================================================
const monitoringExample = {
  // Query para detectar actividad anómala del BOT
  anomalyDetection: `
    -- BOT con muchos errores en la última hora
    SELECT 
      metadata->>'tokenId' as token_id,
      COUNT(*) as error_count,
      COUNT(*) * 100.0 / (
        SELECT COUNT(*) FROM audit_logs 
        WHERE type = 'bot' 
        AND metadata->>'tokenId' = audit_logs.metadata->>'tokenId'
        AND timestamp >= NOW() - INTERVAL '1 hour'
      ) as error_rate
    FROM audit_logs 
    WHERE type = 'bot' 
    AND CAST(metadata->>'statusCode' AS INTEGER) >= 400
    AND timestamp >= NOW() - INTERVAL '1 hour'
    GROUP BY metadata->>'tokenId'
    HAVING COUNT(*) > 10 OR COUNT(*) * 100.0 / (
      SELECT COUNT(*) FROM audit_logs 
      WHERE type = 'bot' 
      AND metadata->>'tokenId' = audit_logs.metadata->>'tokenId'
      AND timestamp >= NOW() - INTERVAL '1 hour'
    ) > 15.0;
  `,
  
  // Alertas automáticas basadas en logs
  alertConditions: {
    highErrorRate: 'Error rate > 15% en 1 hora',
    slowResponses: 'Response time > 5 segundos promedio',
    unusualVolume: 'Volumen de requests > 200% del promedio',
    newTokenUsage: 'Nuevo tokenId detectado',
    suspiciousIPs: 'Múltiples IPs para mismo token'
  }
};

export {
  logFileExample,
  databaseLogExample,
  queryBotLogsExample,
  botStatisticsExample,
  sqlQueriesExamples,
  mainTsConfig,
  monitoringExample
};