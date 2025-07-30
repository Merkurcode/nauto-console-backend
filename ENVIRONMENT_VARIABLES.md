# Environment Variables Reference

This document lists all configurable environment variables for the Nauto Console Backend.

## Application Configuration

```bash
# Basic application settings
NODE_ENV=development                    # Environment: development, production, test
PORT=3001                              # Server port
APP_NAME=Nauto Console - Development   # Application display name
API_URL=http://localhost:3001          # Backend API URL
API_VERSION=v1                         # API version
```

## Database Configuration

```bash
# PostgreSQL database connection
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/nauto_console_dev?schema=public
```

## Authentication & Security

```bash
# JWT configuration
JWT_SECRET=dev_jwt_secret_change_this_in_production
JWT_ACCESS_EXPIRATION=1500m            # Access token expiration
JWT_REFRESH_EXPIRATION=7d              # Refresh token expiration

# OTP configuration
OTP_SECRET=dev_otp_secret_change_this_in_production
OTP_EXPIRATION=5                       # OTP expiration in minutes
OTP_STEP=30                           # OTP time step in seconds
OTP_DIGITS=6                          # Number of digits in OTP

# Session security
SESSION_SECRET=dev_session_secret_change_this_in_production_at_least_32_chars
```

## Frontend Configuration

```bash
# Frontend URLs and paths (configurable for different deployments)
FRONTEND_URL=http://localhost:3000                    # Frontend base URL
FRONTEND_LOGIN_PATH=/login                            # Login page path
FRONTEND_PASSWORD_RESET_PATH=/reset-password          # Password reset page path
FRONTEND_EMAIL_VERIFICATION_PATH=/verify-email       # Email verification page path
FRONTEND_DASHBOARD_PATH=/dashboard                    # Dashboard page path
```

## Email Configuration

```bash
# SMTP settings (MailHog for development)
SMTP_HOST=localhost                    # SMTP server host
SMTP_PORT=1025                        # SMTP server port (1025 for MailHog)
SMTP_USER=                            # SMTP username (empty for MailHog)
SMTP_PASSWORD=                        # SMTP password (empty for MailHog)
SMTP_FROM=noreply@localhost           # Default from email address
SMTP_SECURE=false                     # Use SSL/TLS (false for MailHog)

# Email provider settings
EMAIL_PROVIDER=mailhog                # Email provider: mailhog, resend, smtp
SUPPORT_EMAIL=support@nautoconsole.com              # Support team email
NO_REPLY_EMAIL=noreply@nautoconsole.com             # No-reply email address

# Email template customization
EMAIL_COMPANY_LOGO_URL=               # Company logo URL for email templates
EMAIL_PRIMARY_COLOR=#007bff           # Primary color for email templates
EMAIL_SECONDARY_COLOR=#6c757d         # Secondary color for email templates
```

## External Email Providers

```bash
# Resend configuration (for production)
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=nauto@notification.nocodeflows.io
RESEND_API_URL=https://api.resend.com/emails
```

## SMS Configuration

```bash
# SMS Masivos API configuration
SMS_MASIVOS_API_URL=https://api.smsmasivos.com.mx/sms/send
SMS_MASIVOS_API_KEY=your_sms_masivos_api_key
```

## CORS Configuration

```bash
# Cross-Origin Resource Sharing
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

## File Storage Configuration

```bash
# Storage provider
STORAGE_PROVIDER=local                 # Storage provider: local, minio, aws

# MinIO configuration (for development)
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_REGION=us-east-1
MINIO_PUBLIC_BUCKET=public
MINIO_PRIVATE_BUCKET=private

# AWS S3 configuration (for production)
AWS_REGION=us-east-2
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_S3_BUCKET_NAME=your-bucket-name
```

## API Documentation

```bash
# Swagger UI configuration
SWAGGER_USER=admin                     # Swagger UI username
SWAGGER_PASSWORD=admin                 # Swagger UI password
```

## Rate Limiting

```bash
# Request throttling
THROTTLER_TTL=60                       # Time window in seconds
THROTTLER_LIMIT=100                    # Max requests per time window
```

## Logging

```bash
# Application logging
LOG_LEVEL=debug                        # Log level: debug, info, warn, error
```

## Environment-Specific Examples

### Development (.env)
```bash
NODE_ENV=development
EMAIL_PROVIDER=mailhog
SMTP_HOST=localhost
SMTP_PORT=1025
FRONTEND_URL=http://localhost:3000
API_URL=http://localhost:3001
LOG_LEVEL=debug
```

### Production (.env.production)
```bash
NODE_ENV=production
EMAIL_PROVIDER=resend
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_SECURE=true
FRONTEND_URL=https://your-domain.com
API_URL=https://api.your-domain.com
LOG_LEVEL=info
```

### Testing (.env.test)
```bash
NODE_ENV=test
EMAIL_PROVIDER=mailhog
DATABASE_URL=postgresql://test:test@localhost:5432/test_db
LOG_LEVEL=error
```

## Security Considerations

1. **Never commit production secrets** to version control
2. **Use strong, unique secrets** for JWT and session keys
3. **Configure proper CORS origins** for production
4. **Use HTTPS** in production environments
5. **Set appropriate email rate limits** to prevent abuse
6. **Use environment-specific configurations** for different deployment stages

## Email Template Customization

The email templates support the following customizable elements through environment variables:

- **Company Logo**: Set `EMAIL_COMPANY_LOGO_URL` to display your logo in emails
- **Brand Colors**: Customize `EMAIL_PRIMARY_COLOR` and `EMAIL_SECONDARY_COLOR`
- **Support Contact**: Configure `SUPPORT_EMAIL` for customer support references
- **Frontend Paths**: Customize all frontend routes through `FRONTEND_*_PATH` variables

This allows for easy white-labeling and customization without code changes.