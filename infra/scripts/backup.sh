#!/usr/bin/env bash
# =============================================================================
# Aiyedun Nightly Backup Script
# Backs up: PostgreSQL database, ChromaDB volume
# Retention: 7 days
# Log: /var/log/aiyedun-backup.log
# Recommended crontab: 0 2 * * * /opt/aiyedun/enterprise-ai/infra/scripts/backup.sh
# =============================================================================

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
BACKUP_DIR="/opt/aiyedun/backups"
LOG_FILE="/opt/aiyedun/backups/backup.log"
RETENTION_DAYS=7
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DATE_LABEL=$(date +"%Y-%m-%d")

POSTGRES_CONTAINER="aiyedun-postgres"
CHROMADB_CONTAINER="aiyedun-chromadb"
CHROMA_VOLUME="infra_chroma_data"   # docker volume name (compose project prefix)

PG_USER="aiyedun_user"
PG_DB="aiyedun"

# ── Helpers ───────────────────────────────────────────────────────────────────
log() {
    local msg="[$(date +'%Y-%m-%d %H:%M:%S')] $*"
    echo "$msg" | tee -a "$LOG_FILE"
}

fail() {
    log "ERROR: $*"
    exit 1
}

# ── Setup ─────────────────────────────────────────────────────────────────────
mkdir -p "$BACKUP_DIR"/{postgres,chroma}
touch "$LOG_FILE"

log "===== Aiyedun backup started (${TIMESTAMP}) ====="

# ── PostgreSQL dump ───────────────────────────────────────────────────────────
log "Backing up PostgreSQL database '${PG_DB}'..."

PG_DUMP_FILE="${BACKUP_DIR}/postgres/aiyedun_pg_${TIMESTAMP}.sql.gz"

if ! docker ps --format '{{.Names}}' | grep -q "^${POSTGRES_CONTAINER}$"; then
    fail "Container '${POSTGRES_CONTAINER}' is not running — aborting PostgreSQL backup"
fi

docker exec "$POSTGRES_CONTAINER" \
    pg_dump -U "$PG_USER" "$PG_DB" \
    | gzip > "$PG_DUMP_FILE"

PG_SIZE=$(du -sh "$PG_DUMP_FILE" | cut -f1)
log "PostgreSQL backup complete: ${PG_DUMP_FILE} (${PG_SIZE})"

# ── ChromaDB volume backup ────────────────────────────────────────────────────
log "Backing up ChromaDB volume '${CHROMA_VOLUME}'..."

CHROMA_DUMP_FILE="${BACKUP_DIR}/chroma/aiyedun_chroma_${TIMESTAMP}.tar.gz"

# Use a temporary busybox container to tar the named volume
docker run --rm \
    -v "${CHROMA_VOLUME}:/data:ro" \
    -v "${BACKUP_DIR}/chroma:/backup" \
    busybox \
    tar czf "/backup/aiyedun_chroma_${TIMESTAMP}.tar.gz" -C /data .

CHROMA_SIZE=$(du -sh "$CHROMA_DUMP_FILE" | cut -f1)
log "ChromaDB backup complete: ${CHROMA_DUMP_FILE} (${CHROMA_SIZE})"

# ── Retention cleanup ─────────────────────────────────────────────────────────
log "Removing backups older than ${RETENTION_DAYS} days..."

find "${BACKUP_DIR}/postgres" -name "aiyedun_pg_*.sql.gz"    -mtime +${RETENTION_DAYS} -delete
find "${BACKUP_DIR}/chroma"   -name "aiyedun_chroma_*.tar.gz" -mtime +${RETENTION_DAYS} -delete

REMAINING_PG=$(find "${BACKUP_DIR}/postgres" -name "*.sql.gz" | wc -l)
REMAINING_CHROMA=$(find "${BACKUP_DIR}/chroma" -name "*.tar.gz" | wc -l)
log "Retention cleanup done — ${REMAINING_PG} postgres, ${REMAINING_CHROMA} chroma backups retained"

# ── Total backup size ─────────────────────────────────────────────────────────
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
log "Total backup directory size: ${TOTAL_SIZE}"

log "===== Backup completed successfully (${TIMESTAMP}) ====="
exit 0
