#!/usr/bin/env bash
# backup-mongo.sh — Copia diaria de todas las bases de datos.
# Se programa con cron: 0 3 * * * bash /opt/filanex/nexospro/deploy/backup-mongo.sh
set -euo pipefail

DEST=/opt/backups/mongo
FECHA=$(date +%Y%m%d-%H%M)
mkdir -p "$DEST"

mongodump --out "$DEST/$FECHA"

# Conserva solo los últimos 14 días
find "$DEST" -maxdepth 1 -type d -mtime +14 -exec rm -rf {} +

echo "Backup creado en $DEST/$FECHA"
