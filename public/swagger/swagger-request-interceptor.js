/**
 * Swagger UI Request Interceptor for Signature Generation
 * This interceptor is called by Swagger UI before each request
 */

window.swaggerRequestInterceptor = async (request) => {
  console.log('Swagger Request Interceptor called:', request);
  
  // Configuration - Load from localStorage
  const SERVER_SECRET = localStorage.getItem('swagger-server-secret') || '';
  const BOT_SECRET = localStorage.getItem('swagger-bot-secret') || '';
  const secretType = localStorage.getItem('swagger-secret-type') || 'server';
  
  // Public endpoints that skip signature validation
  const SKIP_PATHS = [
    '/api/health',
    '/api/health/database',
    '/api/health/ready',
    '/api/health/live',
    '/api/auth/login',
    '/api/auth/verify-otp',
    '/api/auth/refresh-token',
    '/api/auth/email/verify',
    '/api/auth/password/request-reset',
    '/api/auth/password/reset',
    '/api/companies/by-host',
  ];
  
  /**
   * Generate HMAC-SHA256 signature
   */
  async function generateSignature(payload, secret) {
    const encoder = new TextEncoder();
    const data = encoder.encode(payload);
    const keyData = encoder.encode(secret);
    
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', key, data);
    return Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
  
  /**
   * Build payload for signature - MATCH SERVER MIDDLEWARE FORMAT
   */
  function buildPayload(method, path, timestamp, body) {
    // Build full URL (like server middleware)  
    const baseUrl = window.location.origin;
    const fullUrl = baseUrl + path;
    
    // Stringify body (match server format)
    let bodyStr = '';
    if (body && typeof body === 'object' && Object.keys(body).length > 0) {
      // Sort keys for consistent signature (match server)
      const sortedBody = Object.keys(body)
        .sort()
        .reduce((obj, key) => {
          obj[key] = body[key];
          return obj;
        }, {});
      bodyStr = JSON.stringify(sortedBody);
    } else if (body && typeof body === 'string') {
      bodyStr = body;
    }
    
    // Use server format: METHOD|FULL_URL|BODY|TIMESTAMP
    const components = [method.toUpperCase(), fullUrl, bodyStr, timestamp];
    return components.join('|');
  }
  
  /**
   * Parse URL to get path
   */
  function getPathFromUrl(url) {
    try {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        const urlObj = new URL(url);
        return urlObj.pathname + urlObj.search;
      } else {
        return url.split('?')[0];
      }
    } catch (e) {
      return url;
    }
  }
  
  /**
   * Check if path should skip signature
   */
  function shouldSkipSignature(path) {
    return SKIP_PATHS.some(skipPath => path.startsWith(skipPath));
  }
  
  // Get the path from the request URL
  const path = getPathFromUrl(request.url);
  
  // Check if we should add signature
  if (!shouldSkipSignature(path) && secretType !== 'none') {
    const secret = secretType === 'bot' ? BOT_SECRET : SERVER_SECRET;
    
    if (secret) {
      // Use 10-minute window timestamp like server middleware
      const timestamp = Math.floor(Date.now() / (10 * 60 * 1000)).toString();
      const method = request.method || 'GET';
      
      // Parse body
      let bodyObj = null;
      if (request.body) {
        try {
          bodyObj = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
        } catch (e) {
          bodyObj = request.body;
        }
      }
      
      // Build payload and generate signature
      const payload = buildPayload(method, path, timestamp, bodyObj);
      const signature = await generateSignature(payload, secret);
      
      // Add headers to request
      request.headers = request.headers || {};
      request.headers['x-signature'] = signature;
      request.headers['x-timestamp'] = timestamp;
      
      console.log('Added signature to Swagger request:', {
        path,
        method,
        timestamp,
        payload,
        signature,
        secretType
      });
    } else {
      console.warn('No secret configured for signature generation');
    }
  } else {
    console.log('Skipping signature for path:', path);
  }
  
  return request;
};

// Log that the interceptor is ready
console.log('Swagger request interceptor loaded and ready');
console.log('Configure secrets via localStorage:');
console.log('  localStorage.setItem("swagger-server-secret", "your_secret")');
console.log('  localStorage.setItem("swagger-secret-type", "server")');