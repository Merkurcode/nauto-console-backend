# Swagger Request Signature Configuration

## Overview

The API uses request signature verification to ensure request integrity and prevent tampering. This document explains how to use the automatic signature calculation feature in the Swagger UI.

## How It Works

The request signature is calculated using HMAC-SHA256 with the following payload structure:

```
METHOD:PATH:TIMESTAMP[:BODY]
```

Where:
- `METHOD`: HTTP method (GET, POST, PUT, DELETE, etc.)
- `PATH`: Request path (e.g., `/api/users`)
- `TIMESTAMP`: Current timestamp in milliseconds
- `BODY`: JSON body (only for requests with a body, sorted by keys)

## Using Signature in Swagger UI

### 1. Access Swagger Documentation

Navigate to `/docs` in your browser to access the Swagger UI.

### 2. Configure Signature Settings

After the page loads, you'll see a **Request Signature Configuration** section below the authentication area with the following options:

#### Secret Type
- **Server Secret**: Use this for regular API requests (default)
- **Bot Secret**: Use this for BOT user requests
- **No Signature**: Disable signature generation (only for public endpoints)

#### Server Secret
Enter the `SERVER_INTEGRITY_SECRET` value from your environment configuration.

#### Bot Secret
Enter the `BOT_INTEGRITY_SECRET` value from your environment configuration.

### 3. Automatic Signature Generation

Once configured, the signature will be automatically calculated and added to all API requests as the `x-signature` header, along with the `x-timestamp` header.

### 4. Public Endpoints

The following endpoints do not require signature verification:
- `/api/health`
- `/api/health/database`
- `/api/health/ready`
- `/api/health/live`
- `/api/auth/login`
- `/api/auth/verify-otp`
- `/api/auth/refresh-token`
- `/api/auth/email/verify`
- `/api/auth/password/request-reset`
- `/api/auth/password/reset`
- `/api/companies/by-host`

## Configuration Persistence

Your signature configuration is saved in the browser's local storage and will persist across sessions. The following values are stored:
- `swagger-server-secret`: Your server secret
- `swagger-bot-secret`: Your bot secret
- `swagger-secret-type`: Selected secret type (server/bot/none)

## Security Notes

1. **Never share your secrets**: The signature secrets should be kept confidential and never exposed in client-side code or version control.

2. **Use HTTPS**: Always use HTTPS in production to prevent secrets from being transmitted in plain text.

3. **Rotate secrets regularly**: Change your signature secrets periodically for enhanced security.

4. **Browser Console**: You can debug signature generation by checking the browser console, which logs signature details (with truncated signature values for security).

## Troubleshooting

### Signature Verification Failed (401 Unauthorized)

**Possible causes:**
1. Incorrect secret entered in the configuration
2. Wrong secret type selected (server vs bot)
3. Timestamp drift between client and server
4. Request body not matching the signature payload

**Solutions:**
1. Verify the secret matches your `.env` configuration
2. Ensure you're using the correct secret type for your request
3. Check that your system clock is synchronized
4. For debugging, check the browser console for the payload being signed

### No Signature Header Added

**Possible causes:**
1. No secret configured
2. Secret type set to "None"
3. Requesting a public endpoint that skips signature

**Solutions:**
1. Enter the appropriate secret in the configuration
2. Select either "Server Secret" or "Bot Secret"
3. Public endpoints don't require signatures

## Example Usage

1. **For regular API testing:**
   - Select "Server Secret" 
   - Enter your `SERVER_INTEGRITY_SECRET`
   - Make API requests normally through Swagger UI

2. **For BOT user testing:**
   - First authenticate as a BOT user to get a Bearer token
   - Select "Bot Secret"
   - Enter your `BOT_INTEGRITY_SECRET`
   - Make API requests with the BOT Bearer token

## Development Tips

- Use simple secrets in development for easier testing (e.g., "development_server_secret_12345678901234567890")
- Keep production secrets complex and randomly generated
- The browser console shows detailed signature information for debugging
- You can access the signature functions programmatically via `window.SwaggerSignature` object

## Manual Signature Calculation

If you need to calculate signatures manually (e.g., for testing with curl or Postman), here's a Node.js example:

```javascript
const crypto = require('crypto');

function generateSignature(method, path, timestamp, body, secret) {
  const parts = [method.toUpperCase(), path, timestamp];
  
  if (body && Object.keys(body).length > 0) {
    // Sort keys for consistent signature
    const sortedBody = Object.keys(body)
      .sort()
      .reduce((obj, key) => {
        obj[key] = body[key];
        return obj;
      }, {});
    parts.push(JSON.stringify(sortedBody));
  }
  
  const payload = parts.join(':');
  return crypto.createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

// Example usage
const timestamp = Date.now().toString();
const signature = generateSignature(
  'POST',
  '/api/users',
  timestamp,
  { email: 'test@example.com', name: 'Test User' },
  'your_server_secret_here'
);

console.log('x-signature:', signature);
console.log('x-timestamp:', timestamp);
```

## Related Documentation

- [Request Integrity Middleware](./REQUEST_INTEGRITY.md)
- [API Authentication](./AUTHENTICATION.md)
- [Security Best Practices](./SECURITY.md)