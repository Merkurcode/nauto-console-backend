/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { REQUEST_INTEGRITY_SKIP_PATHS } from '@shared/constants/paths';

@Injectable()
export class ValidateSignatureMiddleware implements NestMiddleware {
  private readonly maxPatternLength = 200; // Limitar longitud de patrones para evitar ReDoS
  private readonly maxContentLength = 10485760; // 10MB máximo por defecto

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {
    this.validateEnvironmentVariables();
  }

  private validateEnvironmentVariables(): void {
    const missingVars: string[] = [];
    const invalidVars: string[] = [];

    // Check if REQUEST_INTEGRITY_ENABLED exists and is valid boolean
    const integrityEnabled = this.configService.get<string>('REQUEST_INTEGRITY_ENABLED');
    if (integrityEnabled === undefined || integrityEnabled === null) {
      missingVars.push('REQUEST_INTEGRITY_ENABLED');
    } else if (!['true', 'false'].includes(integrityEnabled.toLowerCase())) {
      invalidVars.push('REQUEST_INTEGRITY_ENABLED (must be true or false)');
    }

    // If integrity is enabled, check required secrets
    if (integrityEnabled?.toLowerCase() === 'true') {
      const serverSecret = this.configService.get<string>('SERVER_INTEGRITY_SECRET');
      if (!serverSecret) {
        missingVars.push('SERVER_INTEGRITY_SECRET');
      } else if (serverSecret.length < 32) {
        invalidVars.push('SERVER_INTEGRITY_SECRET (minimum 32 characters required)');
      }

      const botSecret = this.configService.get<string>('BOT_INTEGRITY_SECRET');
      if (!botSecret) {
        missingVars.push('BOT_INTEGRITY_SECRET');
      } else if (botSecret.length < 32) {
        invalidVars.push('BOT_INTEGRITY_SECRET (minimum 32 characters required)');
      }

      const jwtSecret = this.configService.get<string>('jwt.secret');
      if (!jwtSecret) {
        missingVars.push('jwt.secret');
      } else if (jwtSecret.length < 32) {
        invalidVars.push('jwt.secret (minimum 32 characters required)');
      }
    }

    // Check timestamp skew
    const timestampSkew = this.configService.get<string>('SIGNATURE_TIMESTAMP_SKEW_SECONDS');
    if (timestampSkew === undefined || timestampSkew === null) {
      missingVars.push('SIGNATURE_TIMESTAMP_SKEW_SECONDS');
    } else {
      const skewNumber = Number(timestampSkew);
      if (isNaN(skewNumber) || skewNumber < 0 || skewNumber > 300) {
        invalidVars.push('SIGNATURE_TIMESTAMP_SKEW_SECONDS (must be a number between 0 and 300)');
      }
    }

    // Check validation logs
    const validationLogs = this.configService.get<string>('SIGNATURE_VALIDATION_LOGS');
    if (validationLogs === undefined || validationLogs === null) {
      missingVars.push('SIGNATURE_VALIDATION_LOGS');
    } else if (!['true', 'false'].includes(validationLogs.toLowerCase())) {
      invalidVars.push('SIGNATURE_VALIDATION_LOGS (must be true or false)');
    }

    // Check max content length
    const maxContentLength = this.configService.get<string>('REQUEST_MAX_CONTENT_LENGTH');
    if (maxContentLength === undefined || maxContentLength === null) {
      missingVars.push('REQUEST_MAX_CONTENT_LENGTH');
    } else {
      const lengthNumber = Number(maxContentLength);
      if (isNaN(lengthNumber) || lengthNumber < 0 || lengthNumber > 104857600) {
        // 100MB max
        invalidVars.push(
          'REQUEST_MAX_CONTENT_LENGTH (must be a number between 0 and 104857600 bytes)',
        );
      }
    }

    // Report errors
    if (missingVars.length > 0 || invalidVars.length > 0) {
      const errorMessages = [];

      if (missingVars.length > 0) {
        errorMessages.push(`Missing required environment variables: ${missingVars.join(', ')}`);
      }

      if (invalidVars.length > 0) {
        errorMessages.push(`Invalid environment variables: ${invalidVars.join(', ')}`);
      }

      const fullErrorMessage = [
        'ValidateSignatureMiddleware configuration error:',
        ...errorMessages,
        '',
        'Please check your .env file and ensure all required variables are properly configured.',
        'For security reasons, all secrets must be at least 32 characters long.',
      ].join('\n');

      throw new Error(fullErrorMessage);
    }

    // Log successful validation in development
    const enableLogs = this.configService.get<boolean>('SIGNATURE_VALIDATION_LOGS', false);
    if (enableLogs) {
      console.warn(
        '✅ ValidateSignatureMiddleware: All environment variables validated successfully',
      );
    }
  }

  use(req: Request, res: Response, next: NextFunction) {
    const enableLogs = this.configService.get<boolean>('SIGNATURE_VALIDATION_LOGS', false);

    try {
      // Verificar si el middleware está habilitado
      const isEnabled = this.configService.get<boolean>('REQUEST_INTEGRITY_ENABLED', false);
      if (!isEnabled) {
        return next();
      }

      const path = req.path;

      // Verificar si la ruta debe saltarse (aplicable en todos los ambientes)
      if (this.shouldSkipValidation(path)) {
        return next();
      }

      // Rechazar datos comprimidos por seguridad
      this.rejectCompressedData(req);

      // Validar content-length antes de procesar
      this.validateContentLength(req);

      // Obtener el secret basado en el JWT (con validación completa)
      const secret = this.getSecretFromJWT(req);

      const allowedTimestampSkewSeconds = this.configService.get<number>(
        'SIGNATURE_TIMESTAMP_SKEW_SECONDS',
        30,
      );

      const signature = req.headers['x-signature'];
      const timestampHeader = req.headers['x-timestamp'];
      const requestIdHeader = req.headers['x-request-id'];

      if (!signature || typeof signature !== 'string') {
        throw new UnauthorizedException('Signature not found');
      }
      if (!timestampHeader || typeof timestampHeader !== 'string') {
        throw new BadRequestException('x-timestamp is required');
      }
      if (!requestIdHeader || typeof requestIdHeader !== 'string') {
        throw new BadRequestException('x-request-id is required');
      }

      // Validar formato de la firma
      if (!signature.startsWith('sha256=')) {
        throw new BadRequestException('Invalid signature format');
      }

      // Validar formato del request ID (evitar inyecciones)
      if (!/^[a-zA-Z0-9_-]{1,100}$/.test(requestIdHeader)) {
        throw new BadRequestException('x-request-id has invalid format');
      }

      const timestamp = Number(timestampHeader);
      if (isNaN(timestamp) || timestamp <= 0) {
        throw new BadRequestException('Invalid x-timestamp');
      }

      const nowUnix = Math.floor(Date.now() / 1000);
      if (Math.abs(nowUnix - timestamp) > allowedTimestampSkewSeconds) {
        throw new UnauthorizedException('Timestamp out of allowed range');
      }

      const method = req.method.toUpperCase();
      const url = req.originalUrl || req.url;

      // Reconstruir el body de manera segura después de las validaciones
      const rawBody = this.getRawBodySafely(req);

      // Incluir headers importantes en la firma para mayor seguridad
      const contentType = req.headers['content-type'] || '';
      const contentLength = req.headers['content-length'] || '0';
      const contentEncoding = req.headers['content-encoding'] || 'identity';
      const authorization = req.headers['authorization'] || '';
      const requestId = req.headers['x-request-id'] || '';
      const host = this.getHostSafely(req);

      // Construcción consistente del string para firmar
      // Incluimos: método, url, body, timestamp, content-type, content-length, content-encoding, authorization, request-id y host
      const dataToSign = `${method}\n${url}\n${rawBody}\n${timestamp}\n${contentType}\n${contentLength}\n${contentEncoding}\n${authorization}\n${requestId}\n${host}`;

      const hmac = createHmac('sha256', secret);
      hmac.update(dataToSign, 'utf8');
      const calculatedSignature = 'sha256=' + hmac.digest('hex');

      const sigBuffer = Buffer.from(signature, 'utf8');
      const calcBuffer = Buffer.from(calculatedSignature, 'utf8');

      // Verificación segura de la firma
      if (sigBuffer.length !== calcBuffer.length || !timingSafeEqual(sigBuffer, calcBuffer)) {
        // Log para debugging sin exponer información sensible
        if (enableLogs) {
          console.error('Invalid signature:', {
            path: req.path,
            method: req.method,
            timestamp,
            receivedLength: sigBuffer.length,
            expectedLength: calcBuffer.length,
          });
        }
        throw new UnauthorizedException('Invalid signature');
      }

      next();
    } catch (error) {
      // Manejo consistente de errores
      if (error instanceof UnauthorizedException || error instanceof BadRequestException) {
        throw error;
      }

      // Log del error para debugging (sin exponer información sensible)
      if (enableLogs) {
        console.error('Error in signature validation:', {
          message: error.message,
          path: req.path,
          method: req.method,
        });
      }

      throw new UnauthorizedException('Error in signature validation');
    }
  }

  private rejectCompressedData(req: Request): void {
    const contentEncoding = req.headers['content-encoding'];

    // Lista de encodings comprimidos que NO aceptamos por seguridad
    const compressedEncodings = ['gzip', 'deflate', 'br', 'compress', 'x-gzip', 'x-deflate'];

    if (contentEncoding && contentEncoding !== 'identity') {
      // Verificar si es un encoding comprimido
      const encoding = contentEncoding.toLowerCase().trim();

      if (compressedEncodings.includes(encoding)) {
        throw new BadRequestException(
          `Compressed data not allowed. Content-Encoding: ${contentEncoding} is not supported for security reasons`,
        );
      }

      // Rechazar también encodings múltiples o desconocidos
      if (encoding.includes(',') || encoding.includes(' ')) {
        throw new BadRequestException('Multiple or complex encodings are not allowed');
      }

      // Si no es 'identity' y no está en la lista conocida, rechazar por precaución
      if (encoding !== 'identity') {
        throw new BadRequestException(`Unknown Content-Encoding: ${contentEncoding}`);
      }
    }

    // También verificar Transfer-Encoding
    const transferEncoding = req.headers['transfer-encoding'];
    if (transferEncoding && transferEncoding !== 'identity') {
      // chunked es aceptable solo si no está combinado con compresión
      if (transferEncoding !== 'chunked') {
        throw new BadRequestException(
          `Transfer-Encoding not allowed: ${transferEncoding}. Only 'chunked' or 'identity' are permitted`,
        );
      }
    }
  }

  private validateContentLength(req: Request): void {
    const contentLength = req.headers['content-length'];

    if (contentLength) {
      const length = parseInt(contentLength, 10);

      if (isNaN(length) || length < 0) {
        throw new BadRequestException('Invalid Content-Length');
      }

      const maxAllowed = this.configService.get<number>(
        'REQUEST_MAX_CONTENT_LENGTH',
        this.maxContentLength,
      );

      if (length > maxAllowed) {
        throw new BadRequestException(
          `Content-Length exceeds maximum allowed of ${maxAllowed} bytes`,
        );
      }
    }
  }

  private getSecretFromJWT(req: Request): string {
    const authHeader = req.headers.authorization;

    // Si no hay JWT, en rutas que requieren firma usar SERVER_INTEGRITY_SECRET
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const serverSecret = this.configService.get<string>('SERVER_INTEGRITY_SECRET');
      if (!serverSecret) {
        throw new UnauthorizedException(
          'Invalid security configuration: missing SERVER_INTEGRITY_SECRET',
        );
      }

      return serverSecret;
    }

    try {
      const token = authHeader.substring(7);

      // IMPORTANTE: Validar el JWT completamente, no solo decodificarlo
      const jwtSecret = this.configService.get<string>('jwt.secret');
      if (!jwtSecret) {
        throw new UnauthorizedException('Invalid JWT configuration');
      }

      // Verificar el JWT con la clave correcta
      const decoded = this.jwtService.verify(token, {
        secret: jwtSecret,
        ignoreExpiration: false, // No ignorar expiración
      }) as any;

      if (!decoded) {
        throw new UnauthorizedException('Invalid JWT token');
      }

      // Verificar si el usuario tiene rol BOT
      if (decoded.role && decoded.role.name === 'bot') {
        const botSecret = this.configService.get<string>('BOT_INTEGRITY_SECRET');
        if (!botSecret) {
          throw new UnauthorizedException(
            'Invalid BOT security configuration: missing BOT_INTEGRITY_SECRET',
          );
        }

        return botSecret;
      }

      // Usuario normal, usar SERVER_INTEGRITY_SECRET
      const serverSecret = this.configService.get<string>('SERVER_INTEGRITY_SECRET');
      if (!serverSecret) {
        throw new UnauthorizedException(
          'Invalid security configuration: missing SERVER_INTEGRITY_SECRET',
        );
      }

      return serverSecret;
    } catch (error) {
      // Si hay error verificando el JWT, rechazar la petición
      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Expired JWT token');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new UnauthorizedException('Invalid JWT token');
      }
      throw new UnauthorizedException('Error in token validation for signature');
    }
  }

  private shouldSkipValidation(path: string): boolean {
    // Limitar longitud del path para evitar ataques
    if (!path || path.length > this.maxPatternLength) {
      return false;
    }

    // Validar que REQUEST_INTEGRITY_SKIP_PATHS esté definido y sea un array
    if (!Array.isArray(REQUEST_INTEGRITY_SKIP_PATHS)) {
      const enableLogs = this.configService.get<boolean>('SIGNATURE_VALIDATION_LOGS', false);
      if (enableLogs) {
        console.error('REQUEST_INTEGRITY_SKIP_PATHS is not defined or is not an array');
      }

      return false;
    }

    return REQUEST_INTEGRITY_SKIP_PATHS.some(skipPath => {
      try {
        // Validar que skipPath sea string y tenga longitud razonable
        if (typeof skipPath !== 'string' || skipPath.length > this.maxPatternLength) {
          return false;
        }

        // Escapar caracteres especiales de regex excepto nuestros patrones
        const regexPattern = skipPath
          .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escapar caracteres especiales
          .replace(/\\{uuid\\}/g, '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}')
          .replace(/\\{int\\}/g, '\\d{1,10}') // Limitar longitud de enteros
          .replace(/\\{id\\}/g, '[^/]{1,100}') // Limitar longitud de IDs
          .replace(/\\{string\\}/g, '[^/]{1,100}') // Limitar longitud de strings
          .replace(/:([^/]+)/g, '[^/]{1,100}'); // Para rutas con :param

        // Crear regex con timeout para prevenir ReDoS
        const regex = new RegExp('^' + regexPattern + '(/.*)?$', 'i');
        const startTime = Date.now();
        const result = regex.test(path);

        // Si la regex toma más de 10ms, considerar sospechoso
        if (Date.now() - startTime > 10) {
          const enableLogs = this.configService.get<boolean>('SIGNATURE_VALIDATION_LOGS', false);
          if (enableLogs) {
            console.warn(`Regex took too long for pattern: ${skipPath}`);
          }

          return false;
        }

        return result;
      } catch (error) {
        // Si hay error en la regex, no saltar validación
        const enableLogs = this.configService.get<boolean>('SIGNATURE_VALIDATION_LOGS', false);
        if (enableLogs) {
          console.error('Error evaluating skip pattern:', error);
        }

        return false;
      }
    });
  }

  private isLocalhost(req: Request): boolean {
    try {
      const host = this.getHostSafely(req);
      const hostname = host.split(':')[0].toLowerCase();

      // Lista conservadora de hosts locales (sin 0.0.0.0 ni ::)
      const localhostVariants = ['localhost', '127.0.0.1', '::1'];

      return localhostVariants.includes(hostname);
    } catch (_error) {
      // En caso de error, asumir que NO es localhost
      return false;
    }
  }

  private getHostSafely(req: Request): string {
    // Preferir el header 'host' sobre otros headers menos confiables
    const host = req.get('host') || req.hostname || '';

    // Validar formato del host para prevenir inyecciones
    // Permitir solo caracteres alfanuméricos, puntos, guiones y opcionalmente puerto
    if (!/^[a-zA-Z0-9.-]+(?::\d{1,5})?$/.test(host)) {
      throw new BadRequestException('Invalid host header');
    }

    // Validar longitud del host
    if (host.length > 255) {
      throw new BadRequestException('Host header too long');
    }

    return host.toLowerCase();
  }

  private getRawBodySafely(req: Request): string {
    try {
      // Si no hay body, retornar string vacío
      if (!req.body) {
        return '';
      }

      // Verificar el Content-Type para determinar cómo procesar el body
      const contentType = req.headers['content-type'] || '';

      // Si es JSON o text, convertir a string
      if (contentType.includes('application/json') || contentType.includes('text/')) {
        if (typeof req.body === 'string') {
          return req.body;
        }

        // Convertir objeto a JSON string de manera consistente
        if (typeof req.body === 'object') {
          // Ordenar las claves para garantizar consistencia
          return JSON.stringify(this.sortObjectKeys(req.body));
        }
      }

      // Para form-urlencoded
      if (contentType.includes('application/x-www-form-urlencoded')) {
        if (typeof req.body === 'string') {
          return req.body;
        }

        // Convertir objeto a formato urlencoded
        if (typeof req.body === 'object') {
          const params = new URLSearchParams();
          Object.keys(req.body)
            .sort()
            .forEach(key => {
              params.append(key, req.body[key]);
            });

          return params.toString();
        }
      }

      // Para otros tipos de contenido o si no se puede procesar
      if (typeof req.body === 'string') {
        return req.body;
      }

      // Fallback: convertir a JSON
      return JSON.stringify(req.body);
    } catch (_error) {
      // En caso de error, log sin exponer información sensible
      const enableLogs = this.configService.get<boolean>('SIGNATURE_VALIDATION_LOGS', false);
      if (enableLogs) {
        console.error('Error processing body for signature:', {
          contentType: req.headers['content-type'],
          bodyType: typeof req.body,
        });
      }

      // Retornar string vacío en caso de error
      return '';
    }
  }

  private sortObjectKeys(obj: any): any {
    if (obj === undefined || obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sortObjectKeys(item));
    }

    const sorted: any = {};
    Object.keys(obj)
      .sort()
      .forEach(key => {
        sorted[key] = this.sortObjectKeys(obj[key]);
      });

    return sorted;
  }
}
