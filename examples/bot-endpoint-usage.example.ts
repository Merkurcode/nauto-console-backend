import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

// Guards
import { JwtAuthGuard } from '@presentation/guards/jwt-auth.guard';
import { BotOptimizationGuard } from '@presentation/guards/bot-optimization.guard';
import { ThrottlerGuard } from '@presentation/guards/throttler.guard';

// Decorators
import { BotAccess } from '@shared/decorators/bot-access.decorator';
import { Throttle } from '@shared/decorators/throttle.decorator';

/**
 * EJEMPLO: Cómo usar los endpoints optimizados para BOT
 * 
 * Los endpoints marcados con @BotAccess() permiten:
 * - Acceso sin throttling para usuarios BOT
 * - Mantenimiento de seguridad para otros usuarios
 * - Alto volumen de requests para chatbots externos
 */
@ApiTags('chat-api')
@UseGuards(JwtAuthGuard, BotOptimizationGuard, ThrottlerGuard)
@Controller('chat-api')
export class ChatApiController {
  
  /**
   * Endpoint optimizado para BOT - Sin throttling para usuarios BOT
   * Para millones de usuarios del chatbot externo
   */
  @Get('users/context')
  @BotAccess() // ← Este decorador permite acceso optimizado para BOTs
  @Throttle(60, 100) // Límite normal para usuarios no-BOT: 100 req/min
  async getUserContext() {
    return {
      message: 'Este endpoint permite acceso de alta concurrencia para BOTs',
      optimizations: {
        botUsers: 'Sin rate limiting',
        regularUsers: '100 requests per minute',
        security: 'Mantenida para todos los roles'
      }
    };
  }

  /**
   * Endpoint para crear conversaciones - Optimizado para BOT
   */
  @Post('conversations')
  @BotAccess()
  @Throttle(60, 50) // Límite para usuarios no-BOT
  async createConversation() {
    return {
      conversationId: 'conv_12345',
      message: 'BOTs pueden crear millones de conversaciones sin throttling'
    };
  }

  /**
   * Endpoint regular - Sin optimización BOT
   * Mantiene throttling para todos los usuarios
   */
  @Get('analytics')
  @Throttle(60, 10) // 10 requests per minute para todos
  async getAnalytics() {
    return {
      message: 'Este endpoint mantiene rate limiting para todos los usuarios',
      rateLimit: '10 requests per minute'
    };
  }
}

/**
 * CONFIGURACIÓN REQUERIDA EN main.ts:
 * 
 * // Registrar guards en orden correcto
 * app.useGlobalGuards(
 *   new JwtAuthGuard(reflector),
 *   new BotOptimizationGuard(reflector), // ← Debe ir ANTES que ThrottlerGuard
 *   new ThrottlerGuard(reflector, throttlerService, configService),
 *   // otros guards...
 * );
 */

/**
 * EJEMPLO DE USO DEL TOKEN BOT:
 * 
 * 1. Usuario ROOT genera token BOT:
 *    POST /bot-management/tokens/generate
 *    {
 *      "botUserId": "chatbot-external-001",
 *      "botEmail": "chatbot@company.com",
 *      "companyId": "company-uuid-here"
 *    }
 * 
 * 2. Chatbot externo usa el token:
 *    Authorization: Bearer <bot_token_aqui>
 *    
 * 3. Requests a endpoints marcados con @BotAccess():
 *    - Sin rate limiting
 *    - Sin throttling
 *    - Acceso de alta concurrencia
 * 
 * 4. Requests a endpoints sin @BotAccess():
 *    - Mantienen rate limiting normal
 *    - Mismas reglas que usuarios regulares
 */