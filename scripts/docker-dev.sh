#!/bin/bash

# Docker Development Environment Management Script
# Provides easy commands to manage the development environment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}=== $1 ===${NC}"
}

# Function to show usage
show_usage() {
    echo "Docker Development Environment Manager"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  start           Start all core services (postgres, redis, mailhog, minio)"
    echo "  start-admin     Start all services including admin tools (redis-commander)"
    echo "  stop            Stop all services"
    echo "  restart         Restart all services"
    echo "  logs            Show logs from all services"
    echo "  logs [service]  Show logs from specific service"
    echo "  status          Show status of all services"
    echo "  clean           Stop services and remove volumes (DESTRUCTIVE!)"
    echo "  reset-redis     Reset Redis data only"
    echo "  reset-postgres  Reset PostgreSQL data only"
    echo "  shell-redis     Open Redis CLI"
    echo "  shell-postgres  Open PostgreSQL CLI"
    echo "  health          Check health of all services"
    echo "  urls            Show all service URLs and credentials"
    echo ""
}

# Function to start core services
start_services() {
    print_header "Starting Core Services"
    docker-compose up -d postgres redis mailhog minio createbuckets
    print_status "Core services started successfully!"
    show_urls
}

# Function to start with admin tools
start_admin() {
    print_header "Starting All Services (Including Admin Tools)"
    docker-compose --profile admin up -d
    print_status "All services started successfully!"
    show_urls
}

# Function to stop services
stop_services() {
    print_header "Stopping All Services"
    docker-compose down
    print_status "All services stopped successfully!"
}

# Function to restart services
restart_services() {
    print_header "Restarting All Services"
    docker-compose restart
    print_status "All services restarted successfully!"
}

# Function to show logs
show_logs() {
    if [ -z "$1" ]; then
        print_header "Showing Logs from All Services"
        docker-compose logs -f
    else
        print_header "Showing Logs from $1"
        docker-compose logs -f "$1"
    fi
}

# Function to show status
show_status() {
    print_header "Service Status"
    docker-compose ps
}

# Function to clean everything (DESTRUCTIVE)
clean_all() {
    print_warning "This will DESTROY all data in Docker volumes!"
    echo -n "Are you sure? (y/N): "
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        print_header "Cleaning All Data"
        docker-compose down -v
        docker system prune -f
        print_status "All data cleaned successfully!"
    else
        print_status "Operation cancelled."
    fi
}

# Function to reset Redis only
reset_redis() {
    print_warning "This will DESTROY all Redis data (queues, cache, etc.)!"
    echo -n "Are you sure? (y/N): "
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        print_header "Resetting Redis Data"
        docker-compose stop redis
        docker volume rm nestjs-template_redis_data 2>/dev/null || true
        docker-compose up -d redis
        print_status "Redis data reset successfully!"
    else
        print_status "Operation cancelled."
    fi
}

# Function to reset PostgreSQL only
reset_postgres() {
    print_warning "This will DESTROY all PostgreSQL data!"
    echo -n "Are you sure? (y/N): "
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        print_header "Resetting PostgreSQL Data"
        docker-compose stop postgres
        docker volume rm nestjs-template_postgres_data 2>/dev/null || true
        docker-compose up -d postgres
        print_status "PostgreSQL data reset successfully!"
        print_warning "Remember to run 'npm run db:migrate' to recreate the schema!"
    else
        print_status "Operation cancelled."
    fi
}

# Function to open Redis shell
redis_shell() {
    print_header "Opening Redis CLI"
    docker-compose exec redis redis-cli
}

# Function to open PostgreSQL shell
postgres_shell() {
    print_header "Opening PostgreSQL CLI"
    docker-compose exec postgres psql -U postgres -d nestjs_template
}

# Function to check health
check_health() {
    print_header "Checking Service Health"
    
    echo -n "PostgreSQL: "
    if docker-compose exec -T postgres pg_isready -U postgres >/dev/null 2>&1; then
        echo -e "${GREEN}✓ Healthy${NC}"
    else
        echo -e "${RED}✗ Unhealthy${NC}"
    fi
    
    echo -n "Redis: "
    if docker-compose exec -T redis redis-cli ping >/dev/null 2>&1; then
        echo -e "${GREEN}✓ Healthy${NC}"
    else
        echo -e "${RED}✗ Unhealthy${NC}"
    fi
    
    echo -n "MinIO: "
    if curl -s http://localhost:9000/minio/health/ready >/dev/null 2>&1; then
        echo -e "${GREEN}✓ Healthy${NC}"
    else
        echo -e "${RED}✗ Unhealthy${NC}"
    fi
    
    echo -n "MailHog: "
    if curl -s http://localhost:8025/api/v1/messages >/dev/null 2>&1; then
        echo -e "${GREEN}✓ Healthy${NC}"
    else
        echo -e "${RED}✗ Unhealthy${NC}"
    fi
}

# Function to show URLs and credentials
show_urls() {
    print_header "Service URLs and Credentials"
    echo ""
    echo -e "${BLUE}Database:${NC}"
    echo "  PostgreSQL: localhost:5432"
    echo "  User: postgres | Password: postgres | Database: nestjs_template"
    echo ""
    echo -e "${BLUE}Queue System:${NC}"
    echo "  Redis: localhost:6379"
    echo "  Redis Commander: http://localhost:8081 (admin/admin123)"
    echo ""
    echo -e "${BLUE}Email Testing:${NC}"
    echo "  MailHog UI: http://localhost:8025"
    echo "  SMTP: localhost:1025"
    echo ""
    echo -e "${BLUE}Object Storage:${NC}"
    echo "  MinIO Console: http://localhost:9001 (minioadmin/minioadmin)"
    echo "  MinIO API: http://localhost:9000"
    echo ""
}

# Main script logic
case "$1" in
    "start")
        start_services
        ;;
    "start-admin")
        start_admin
        ;;
    "stop")
        stop_services
        ;;
    "restart")
        restart_services
        ;;
    "logs")
        show_logs "$2"
        ;;
    "status")
        show_status
        ;;
    "clean")
        clean_all
        ;;
    "reset-redis")
        reset_redis
        ;;
    "reset-postgres")
        reset_postgres
        ;;
    "shell-redis")
        redis_shell
        ;;
    "shell-postgres")
        postgres_shell
        ;;
    "health")
        check_health
        ;;
    "urls")
        show_urls
        ;;
    *)
        show_usage
        exit 1
        ;;
esac