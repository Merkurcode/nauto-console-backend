# Docker Configuration Guide

This document explains how to run the development environment using Docker.

## 🐳 Services Available

### Core Services
- **PostgreSQL** (Database) - Port 5432
- **Redis** (Queue System) - Port 6379  
- **MailHog** (Email Testing) - Port 8025 (UI), 1025 (SMTP)
- **MinIO** (Object Storage) - Port 9000 (API), 9001 (Console)

### Optional Admin Tools
- **Redis Commander** (Redis Web UI) - Port 8081

## 🚀 Quick Start

### 1. Start Core Services
```bash
# Start all core services
docker-compose up -d

# Or start specific services
docker-compose up -d postgres redis mailhog minio
```

### 2. Start with Admin Tools
```bash
# Start with Redis Commander for queue monitoring
docker-compose --profile admin up -d
```

### 3. Check Service Health
```bash
# Check running containers
docker-compose ps

# Check Redis health
docker-compose exec redis redis-cli ping

# Check PostgreSQL health
docker-compose exec postgres pg_isready -U postgres
```

## 📊 Service Access URLs

| Service | URL | Credentials |
|---------|-----|-------------|
| **PostgreSQL** | `localhost:5432` | User: `postgres`<br>Password: `postgres`<br>Database: `nestjs_template` |
| **Redis** | `localhost:6379` | No authentication (development) |
| **Redis Commander** | http://localhost:8081 | User: `admin`<br>Password: `admin123` |
| **MailHog UI** | http://localhost:8025 | No authentication |
| **MinIO Console** | http://localhost:9001 | User: `minioadmin`<br>Password: `minioadmin` |
| **MinIO API** | http://localhost:9000 | Same as console |

## 🔧 Redis Configuration

Redis is optimized for BullMQ with:
- **Persistence**: RDB + AOF enabled for job durability
- **Memory Management**: LRU eviction policy
- **Performance**: Lazy freeing and optimized data structures
- **Security**: Dangerous commands disabled
- **Monitoring**: Keyspace notifications for BullMQ

### Redis Configuration File
The `redis.conf` file includes:
- Performance optimizations for queue workloads
- Security hardening (disabled FLUSHDB, KEYS, etc.)
- Memory management tuned for BullMQ
- Persistence settings for job reliability

## 📋 Queue System Monitoring

### Redis Commander Features
- Browse Redis keys and data structures
- Monitor queue jobs and their states
- View BullMQ job details and metadata
- Real-time memory and performance metrics

### BullMQ Endpoints (when app is running)
- **Health Check**: GET `/api/healthz`
- **Queue Status**: GET `/api/events/status?queue=events`
- **Queue List**: GET `/api/events/queues`
- **Job Management**: GET `/api/events/jobs?queue=events`

## 🛠️ Common Operations

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f redis
docker-compose logs -f postgres
```

### Reset Data
```bash
# Reset Redis data (clears all queues)
docker-compose down
docker volume rm nestjs-template_redis_data
docker-compose up -d redis

# Reset PostgreSQL data
docker-compose down
docker volume rm nestjs-template_postgres_data
docker-compose up -d postgres
```

### Access Service Shells
```bash
# Redis CLI
docker-compose exec redis redis-cli

# PostgreSQL CLI
docker-compose exec postgres psql -U postgres -d nestjs_template

# View Redis configuration
docker-compose exec redis redis-cli CONFIG GET "*"
```

## 🔍 Troubleshooting

### Redis Issues
```bash
# Check Redis logs
docker-compose logs redis

# Test Redis connectivity
docker-compose exec redis redis-cli ping

# Monitor Redis commands
docker-compose exec redis redis-cli monitor
```

### PostgreSQL Issues
```bash
# Check database connection
docker-compose exec postgres pg_isready -U postgres

# List databases
docker-compose exec postgres psql -U postgres -l
```

### MinIO Issues
```bash
# Check MinIO logs
docker-compose logs minio

# Test bucket creation
docker-compose logs createbuckets
```

## 📱 Production Considerations

For production deployment:

1. **Security**: 
   - Enable Redis authentication
   - Use proper TLS certificates
   - Change default passwords

2. **Performance**:
   - Adjust Redis maxmemory based on available RAM
   - Configure Redis persistence according to durability needs
   - Use Redis Cluster for horizontal scaling

3. **Monitoring**:
   - Add Redis monitoring (Prometheus + Grafana)
   - Configure log aggregation
   - Set up health check alerting

4. **Backup**:
   - Schedule Redis RDB backups
   - Configure PostgreSQL backups
   - Backup MinIO data regularly

## 🔗 Related Documentation

- [Queue System Documentation](src/queues/README.md)
- [Environment Variables Guide](.env.example)
- [Application Configuration](src/infrastructure/config/configuration.ts)