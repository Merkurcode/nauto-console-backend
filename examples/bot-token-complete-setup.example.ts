/**
 * EJEMPLO COMPLETO: Configuración de Token BOT Infinito
 * 
 * Esta guía muestra cómo configurar y usar tokens BOT infinitos
 * que funcionan correctamente con todo el sistema JWT.
 */

// 1. ✅ CONFIGURACIÓN JWT STRATEGY
// src/presentation/modules/auth/strategies/jwt.strategy.ts
/*
super({
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  ignoreExpiration: true, // ← PERMITE tokens sin exp (BOT tokens)
  secretOrKey: jwtSecret,
});

// Validación personalizada:
const isBotToken = payload.permissions?.includes('all:access');
if (!isBotToken && payload.exp) {
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) {
    throw new UnauthorizedException('Token has expired');
  }
}
*/

// 2. ✅ GENERACIÓN DE TOKEN BOT
// POST /bot-management/tokens/generate
const botTokenRequest = {
  "botUserId": "chatbot-external-001",
  "botEmail": "chatbot@company.com", 
  "companyId": "550e8400-e29b-41d4-a716-446655440000"
};

const botTokenResponse = {
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...", // ← Token SIN exp
  "expiresIn": "never",
  "tokenId": "bot_1691424000_abc123def456"
};

// 3. ✅ PAYLOAD DEL TOKEN BOT GENERADO
const decodedBotToken = {
  "sub": "chatbot-external-001",
  "email": "chatbot@company.com",
  "emailVerified": true,
  "isActive": true,
  "roles": ["bot", "root"], // ← Roles BOT + ROOT
  "permissions": ["all:access"], // ← Permiso especial OCULTO
  "tenantId": "550e8400-e29b-41d4-a716-446655440000",
  "companyId": "550e8400-e29b-41d4-a716-446655440000",
  "tokenType": "bot",
  "tokenId": "bot_1691424000_abc123def456",
  "iat": 1691424000
  // ← SIN 'exp' = Token infinito
};

// 4. ✅ FLUJO DE VALIDACIÓN JWT
const validationFlow = {
  step1: "JWT Strategy detecta token sin 'exp'",
  step2: "ignoreExpiration: true permite el token",
  step3: "validate() detecta isBotToken = true por 'all:access'",
  step4: "Skip validación de expiración para BOT",
  step5: "Skip validación de sesión para BOT", 
  step6: "PermissionsGuard detecta 'all:access' = return true",
  step7: "ThrottlerGuard skip por isBotRequest",
  result: "ACCESO COMPLETO SIN RESTRICCIONES"
};

// 5. ✅ EJEMPLO DE USO DEL CHATBOT
const chatbotUsage = {
  headers: {
    "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "Content-Type": "application/json"
  },
  
  // Acceso a cualquier endpoint:
  endpoints: {
    users: "GET /users ✅ - Sin throttling", 
    companies: "GET /companies ✅ - Sin throttling",
    roles: "POST /roles ✅ - Sin throttling",
    files: "POST /storage/upload ✅ - Sin throttling",
    any: "ANY /any-endpoint ✅ - Sin restricciones"
  }
};

// 6. ✅ MONITOREO Y LOGS
const expectedLogs = {
  tokenGeneration: {
    "message": "BOT token generated",
    "generatedBy": "root-user-id", 
    "botUserId": "chatbot-external-001",
    "tokenId": "bot_1691424000_abc123def456",
    "expiresIn": "never"
  },
  
  tokenValidation: {
    "message": "JWT Strategy validating payload with enhanced security",
    "userId": "chatbot-external-001",
    "isBotToken": true,
    "hasPermissions": true
  },
  
  sessionSkip: {
    "message": "Session validation skipped for BOT token",
    "userId": "chatbot-external-001",
    "tokenId": "bot_1691424000_abc123def456"
  },
  
  permissionsBypass: {
    "message": "BOT-ACCESS detected - full access granted",
    "endpoint": "GET /users",
    "userId": "chatbot-external-001"
  }
};

// 7. ✅ VERIFICACIÓN DE SEGURIDAD
const securityChecks = {
  hiddenPermissions: "❌ 'all:access' NO aparece en GET /permissions",
  manualAssignment: "❌ IMPOSIBLE asignar 'all:access' manualmente",
  rootGeneration: "✅ Solo ROOT puede generar tokens BOT",
  auditLogging: "✅ Todos los usos están auditados",
  revocation: "✅ ROOT puede revocar tokens inmediatamente"
};

// 8. ✅ CONFIGURACIÓN MAIN.TS (ORDEN IMPORTANTE)
const mainTsSetup = `
// main.ts - Guards en orden correcto
app.useGlobalGuards(
  new JwtAuthGuard(reflector),
  new BotOptimizationGuard(reflector), // ← ANTES que ThrottlerGuard
  new ThrottlerGuard(reflector, throttlerService, configService),
  new PermissionsGuard(reflector, userAuthService),
  new RolesGuard(reflector),
  new TenantIsolationGuard(reflector, tenantResolverService),
);
`;

// 9. ✅ TESTING DEL TOKEN INFINITO
const testInfiniteToken = async () => {
  // Generar token BOT
  const response = await fetch('/bot-management/tokens/generate', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer <root-token>',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(botTokenRequest)
  });
  
  const { accessToken } = await response.json();
  
  // Usar token BOT (funcionará por años)
  const chatbotResponse = await fetch('/users', {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
  
  console.log('BOT token works:', chatbotResponse.status === 200);
  // ↑ Debería ser true incluso después de años
};

export {
  botTokenRequest,
  botTokenResponse, 
  decodedBotToken,
  validationFlow,
  chatbotUsage,
  expectedLogs,
  securityChecks,
  mainTsSetup,
  testInfiniteToken
};