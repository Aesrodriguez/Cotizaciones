#!/bin/bash

# Backup script for Cotizaciones PostgreSQL database
# Usage: bash backup.sh [compose-file]
# Example: bash backup.sh docker-compose.prod.yml

set -e

COMPOSE_FILE="${1:-docker-compose.yml}"
BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.sql"
MAX_BACKUPS=30  # Keep last 30 backups

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Check if docker-compose file exists
if [ ! -f "$COMPOSE_FILE" ]; then
    log_error "Docker compose file not found: $COMPOSE_FILE"
    exit 1
fi

# Create backup directory
mkdir -p "$BACKUP_DIR"
log_info "Backup directory: $BACKUP_DIR"

# Get database configuration from docker-compose
POSTGRES_USER=$(grep "POSTGRES_USER:" "$COMPOSE_FILE" | head -1 | awk -F'=' '{print $2}' | tr -d ' :-' || echo "cotizaciones")
POSTGRES_DB=$(grep "POSTGRES_DB:" "$COMPOSE_FILE" | head -1 | awk -F'=' '{print $2}' | tr -d ' :-' || echo "cotizaciones_db")

log_info "Starting backup of database: $POSTGRES_DB"
log_info "User: $POSTGRES_USER"
log_info "Output file: $BACKUP_FILE"

# Perform backup
if docker-compose -f "$COMPOSE_FILE" exec -T postgres \
    pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > "$BACKUP_FILE"; then
    
    # Compress backup
    gzip "$BACKUP_FILE"
    BACKUP_FILE="$BACKUP_FILE.gz"
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    
    log_info "Backup completed successfully!"
    log_info "Backup file: $BACKUP_FILE (Size: $BACKUP_SIZE)"
    
    # Clean up old backups
    BACKUP_COUNT=$(find "$BACKUP_DIR" -name "backup_*.sql.gz" -type f | wc -l)
    if [ "$BACKUP_COUNT" -gt "$MAX_BACKUPS" ]; then
        log_warn "Found $BACKUP_COUNT backups (max: $MAX_BACKUPS). Cleaning up old backups..."
        find "$BACKUP_DIR" -name "backup_*.sql.gz" -type f -printf '%T@ %p\n' | \
            sort -rn | tail -n +$((MAX_BACKUPS + 1)) | cut -d' ' -f2- | while read file; do
            log_info "Removing old backup: $file"
            rm "$file"
        done
    fi
    
    log_info "Backup process completed successfully"
    exit 0
else
    log_error "Backup failed!"
    rm -f "$BACKUP_FILE"
    exit 1
fi
