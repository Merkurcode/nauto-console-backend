/**
 * Swagger UI Custom Extension for Request Signature Generation
 * Automatically calculates and adds x-signature header for API requests
 */

(function() {
  // Configuration - Load from localStorage if available
  const CONFIG = {
    // These should be provided by the server or configured by the user
    SERVER_SECRET: localStorage.getItem('swagger-server-secret') || '',
    BOT_SECRET: localStorage.getItem('swagger-bot-secret') || '',
    USE_BOT_SECRET: (localStorage.getItem('swagger-secret-type') || 'server') === 'bot',
  };

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
      // Handle both absolute and relative URLs
      if (url.startsWith('http://') || url.startsWith('https://')) {
        const urlObj = new URL(url);
        return urlObj.pathname + urlObj.search;
      } else {
        // For relative URLs, just return the path part
        return url.split('?')[0];
      }
    } catch (e) {
      console.error('Error parsing URL:', url, e);
      // Fallback: just return the URL as is
      return url;
    }
  }

  /**
   * Add signature controls to Swagger UI
   */
  function addSignatureControls() {
    // Wait for Swagger UI to load
    setTimeout(() => {
      const authWrapper = document.querySelector('.auth-wrapper');
      if (!authWrapper) {
        // Retry if not found
        setTimeout(addSignatureControls, 1000);
        return;
      }

      // Create signature configuration UI
      const signatureDiv = document.createElement('div');
      signatureDiv.className = 'signature-config';
      signatureDiv.style.cssText = `
        padding: 15px;
        margin: 10px;
        border: 1px solid #89bf04;
        border-radius: 4px;
        background-color: #f7f7f7;
      `;

      signatureDiv.innerHTML = `
        <h4 style="margin-top: 0; color: #3b4151;">Request Signature Configuration</h4>
        <div style="margin-bottom: 10px;">
          <label style="display: block; margin-bottom: 5px; font-weight: bold;">
            Secret Type:
          </label>
          <select id="secret-type" style="width: 100%; padding: 5px; border: 1px solid #ccc; border-radius: 4px;">
            <option value="server">Server Secret</option>
            <option value="bot">Bot Secret</option>
            <option value="none">No Signature</option>
          </select>
        </div>
        <div style="margin-bottom: 10px;">
          <label style="display: block; margin-bottom: 5px; font-weight: bold;">
            Server Secret:
          </label>
          <input 
            type="password" 
            id="server-secret" 
            placeholder="Enter server secret for signature generation"
            style="width: 100%; padding: 5px; border: 1px solid #ccc; border-radius: 4px;"
          />
        </div>
        <div style="margin-bottom: 10px;">
          <label style="display: block; margin-bottom: 5px; font-weight: bold;">
            Bot Secret:
          </label>
          <input 
            type="password" 
            id="bot-secret" 
            placeholder="Enter bot secret for signature generation"
            style="width: 100%; padding: 5px; border: 1px solid #ccc; border-radius: 4px;"
          />
        </div>
        <div style="margin-top: 10px; padding: 10px; background-color: #fff3cd; border: 1px solid #ffc107; border-radius: 4px;">
          <strong>Note:</strong> The x-signature header will be automatically calculated and added to requests.
          <br/>Public endpoints (health, auth/login, etc.) will skip signature validation.
        </div>
      `;

      // Insert after auth wrapper
      authWrapper.parentNode.insertBefore(signatureDiv, authWrapper.nextSibling);

      // Add event listeners
      document.getElementById('server-secret').addEventListener('input', (e) => {
        CONFIG.SERVER_SECRET = e.target.value;
        localStorage.setItem('swagger-server-secret', e.target.value);
      });

      document.getElementById('bot-secret').addEventListener('input', (e) => {
        CONFIG.BOT_SECRET = e.target.value;
        localStorage.setItem('swagger-bot-secret', e.target.value);
      });

      document.getElementById('secret-type').addEventListener('change', (e) => {
        CONFIG.USE_BOT_SECRET = e.target.value === 'bot';
        localStorage.setItem('swagger-secret-type', e.target.value);
      });

      // Load saved values
      const savedServerSecret = localStorage.getItem('swagger-server-secret');
      const savedBotSecret = localStorage.getItem('swagger-bot-secret');
      const savedSecretType = localStorage.getItem('swagger-secret-type') || 'server';

      if (savedServerSecret) {
        document.getElementById('server-secret').value = savedServerSecret;
        CONFIG.SERVER_SECRET = savedServerSecret;
      }

      if (savedBotSecret) {
        document.getElementById('bot-secret').value = savedBotSecret;
        CONFIG.BOT_SECRET = savedBotSecret;
      }

      document.getElementById('secret-type').value = savedSecretType;
      CONFIG.USE_BOT_SECRET = savedSecretType === 'bot';
    }, 1000);
  }

  /**
   * Public endpoints that skip signature validation
   */
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
    '/docs',
    '/',
  ];

  /**
   * Check if path should skip signature
   */
  function shouldSkipSignature(path) {
    return SKIP_PATHS.some(skipPath => {
      if (skipPath.includes(':')) {
        // Handle parameterized paths
        const regex = new RegExp('^' + skipPath.replace(/:[^/]+/g, '[^/]+') + '$');
        return regex.test(path);
      }
      return path.startsWith(skipPath);
    });
  }

  /**
   * Intercept Swagger requests to add signature
   */
  function interceptRequests() {
    // Store original fetch
    const originalFetch = window.fetch;
    
    // Override fetch
    window.fetch = async function(...args) {
      let url = args[0];
      let options = args[1] || {};
      
      // Handle Request objects
      if (url instanceof Request) {
        options = {
          method: url.method,
          headers: Object.fromEntries(url.headers.entries()),
          body: url.body,
          ...options
        };
        url = url.url;
      }
      
      // Determine if this is an API call
      const isApiCall = url.includes('/api/') || url.startsWith('/api/');
      
      if (isApiCall) {
        const path = getPathFromUrl(url);
        const secretType = localStorage.getItem('swagger-secret-type') || 'server';
        
        console.log('Intercepting API request:', {
          url,
          path,
          method: options.method || 'GET',
          secretType,
          shouldSkip: shouldSkipSignature(path)
        });
        
        // Check if we should add signature
        if (!shouldSkipSignature(path) && secretType !== 'none') {
          const secret = secretType === 'bot' ? CONFIG.BOT_SECRET : CONFIG.SERVER_SECRET;
          
          if (secret) {
            // Use 10-minute window timestamp like server middleware
            const timestamp = Math.floor(Date.now() / (10 * 60 * 1000)).toString();
            const method = (options.method || 'GET').toUpperCase();
            
            // Parse body if exists
            let bodyObj = null;
            if (options.body) {
              try {
                bodyObj = JSON.parse(options.body);
              } catch (e) {
                // Body might not be JSON
                console.log('Body is not JSON:', options.body);
              }
            }
            
            // Build payload and generate signature
            const payload = buildPayload(method, path, timestamp, bodyObj);
            const signature = await generateSignature(payload, secret);
            
            // Ensure headers object exists
            if (!options.headers) {
              options.headers = {};
            }
            
            // Handle Headers object
            if (options.headers instanceof Headers) {
              options.headers.set('x-signature', signature);
              options.headers.set('x-timestamp', timestamp);
            } else {
              options.headers['x-signature'] = signature;
              options.headers['x-timestamp'] = timestamp;
            }
            
            console.log('Added signature to request:', {
              path,
              method,
              timestamp,
              payload,
              signature: signature.substring(0, 16) + '...',
              headers: options.headers
            });
          } else {
            console.warn('No secret configured for signature generation');
          }
        }
      }
      
      // Call original fetch
      return originalFetch.call(this, url, options);
    };
    
    // Also intercept XMLHttpRequest for older API calls
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;
    
    XMLHttpRequest.prototype.open = function(method, url, ...args) {
      this._method = method;
      this._url = url;
      return originalXHROpen.call(this, method, url, ...args);
    };
    
    XMLHttpRequest.prototype.send = function(body) {
      if (this._url && (this._url.includes('/api/') || this._url.startsWith('/api/'))) {
        const path = getPathFromUrl(this._url);
        const secretType = localStorage.getItem('swagger-secret-type') || 'server';
        
        if (!shouldSkipSignature(path) && secretType !== 'none') {
          const secret = secretType === 'bot' ? CONFIG.BOT_SECRET : CONFIG.SERVER_SECRET;
          
          if (secret) {
            // Use 10-minute window timestamp like server middleware
            const timestamp = Math.floor(Date.now() / (10 * 60 * 1000)).toString();
            const method = (this._method || 'GET').toUpperCase();
            
            let bodyObj = null;
            if (body) {
              try {
                bodyObj = JSON.parse(body);
              } catch (e) {
                // Body might not be JSON
              }
            }
            
            // Build payload synchronously (XMLHttpRequest doesn't support async well)
            const payload = buildPayload(method, path, timestamp, bodyObj);
            
            // Use a simpler synchronous hash for XMLHttpRequest
            // Note: This is a fallback, prefer fetch for async crypto
            let hash = 0;
            const str = payload + secret;
            for (let i = 0; i < str.length; i++) {
              const char = str.charCodeAt(i);
              hash = ((hash << 5) - hash) + char;
              hash = hash & hash; // Convert to 32bit integer
            }
            const signature = Math.abs(hash).toString(16).padStart(16, '0');
            
            this.setRequestHeader('x-signature', signature);
            this.setRequestHeader('x-timestamp', timestamp);
            
            console.log('Added signature to XMLHttpRequest:', {
              path,
              method,
              timestamp,
              signature: signature.substring(0, 16) + '...'
            });
          }
        }
      }
      
      return originalXHRSend.call(this, body);
    };
  }

  // Initialize interceptors immediately (before DOM is ready)
  interceptRequests();
  console.log('Swagger signature interceptor initialized');

  // Initialize UI when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      addSignatureControls();
    });
  } else {
    addSignatureControls();
  }

  // Also listen for Swagger UI ready event
  window.addEventListener('load', () => {
    setTimeout(() => {
      addSignatureControls();
      // Re-initialize interceptors in case they were overridden
      interceptRequests();
    }, 2000);
  });

  // Export for debugging
  window.SwaggerSignature = {
    CONFIG,
    generateSignature,
    buildPayload,
    shouldSkipSignature,
    getPathFromUrl,
    interceptRequests
  };
  
  // Log that the script is loaded
  console.log('Swagger signature script loaded. Configure secrets using the UI or via:');
  console.log('  localStorage.setItem("swagger-server-secret", "your_secret")');
  console.log('  localStorage.setItem("swagger-secret-type", "server")');
})();