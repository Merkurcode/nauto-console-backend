#!/bin/sh

# Docker entrypoint script for production deployment
# Handles database migrations, health checks, and graceful startup

set -e

echo "Starting NestJS application..."
echo "Node.js version: $(node --version)"
echo "Environment: $NODE_ENV"
echo "Memory limit: $NODE_MAX_OLD_SPACE_SIZE MB"

# Function to wait for services
wait_for_service() {
  local host=$1
  local port=$2
  local service_name=$3
  local timeout=30
  local count=0
  
  echo "Waiting for $service_name at $host:$port..."
  
  while ! nc -z "$host" "$port" 2>/dev/null; do
    if [ $count -ge $timeout ]; then
      echo "ERROR: Timeout waiting for $service_name"
      exit 1
    fi
    echo "Waiting for $service_name... ($count/$timeout)"
    sleep 1
    count=$((count + 1))
  done
  
  echo "$service_name is ready!"
}

# Wait for database if DATABASE_HOST is provided
if [ -n "$DATABASE_HOST" ] && [ -n "$DATABASE_PORT" ]; then
  wait_for_service "$DATABASE_HOST" "$DATABASE_PORT" "Database"
fi

# Wait for Redis if REDIS_HOST is provided
if [ -n "$REDIS_HOST" ] && [ -n "$REDIS_PORT" ]; then
  wait_for_service "$REDIS_HOST" "$REDIS_PORT" "Redis"
fi

# Run database migrations if enabled
if [ "$RUN_MIGRATIONS" = "true" ]; then
  echo "Running database migrations..."
  npx prisma migrate deploy || {
    echo "ERROR: Database migrations failed"
    exit 1
  }
  echo "Database migrations completed successfully"
fi

# Generate Prisma client if needed
if [ "$GENERATE_PRISMA_CLIENT" = "true" ]; then
  echo "Generating Prisma client..."
  npx prisma generate || {
    echo "ERROR: Prisma client generation failed"
    exit 1
  }
  echo "Prisma client generated successfully"
fi

# Set up log directories
mkdir -p logs/application logs/access logs/error

# Pre-flight health check
echo "Running pre-flight health check..."
if ! timeout 10 node -e "
const { execSync } = require('child_process');
try {
  console.log('Basic Node.js functionality: OK');
  console.log('Memory available:', Math.round(process.memoryUsage().heapTotal / 1024 / 1024), 'MB');
  console.log('Pre-flight check: PASSED');
  process.exit(0);
} catch (error) {
  console.error('Pre-flight check: FAILED', error.message);
  process.exit(1);
}
"; then
  echo "ERROR: Pre-flight health check failed"
  exit 1
fi

# Handle graceful shutdown
shutdown_handler() {
  echo "Received shutdown signal, gracefully shutting down..."
  if [ -n "$APP_PID" ]; then
    kill -TERM "$APP_PID"
    wait "$APP_PID"
  fi
  echo "Application shut down completed"
  exit 0
}

# Set up signal handlers
trap 'shutdown_handler' TERM INT

# Start the application with optimized settings
echo "Starting application server..."
echo "Port: ${PORT:-3000}"
echo "Host: ${HOST:-0.0.0.0}"

# Use exec to ensure proper signal handling
exec node \
  --max-old-space-size="${NODE_MAX_OLD_SPACE_SIZE:-2048}" \
  --optimize-for-size \
  --gc-interval=100 \
  --expose-gc \
  dist/main.js &

APP_PID=$!

# Wait for the application to start
sleep 5

# Verify application is responding
echo "Verifying application startup..."
if ! timeout 30 node -e "
const http = require('http');
const options = {
  hostname: '${HOST:-localhost}',
  port: ${PORT:-3000},
  path: '/health',
  method: 'GET',
  timeout: 5000
};

const req = http.request(options, (res) => {
  if (res.statusCode === 200) {
    console.log('Application health check: PASSED');
    process.exit(0);
  } else {
    console.error('Application health check: FAILED - Status:', res.statusCode);
    process.exit(1);
  }
});

req.on('error', (error) => {
  console.error('Application health check: FAILED -', error.message);
  process.exit(1);
});

req.on('timeout', () => {
  console.error('Application health check: TIMEOUT');
  req.destroy();
  process.exit(1);
});

req.end();
"; then
  echo "ERROR: Application startup verification failed"
  kill -TERM "$APP_PID" 2>/dev/null || true
  exit 1
fi

echo "Application started successfully!"
echo "Health endpoint: http://${HOST:-localhost}:${PORT:-3000}/health"

# Keep the script running and wait for the application process
wait "$APP_PID"