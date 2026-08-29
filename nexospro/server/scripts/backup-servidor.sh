#!/usr/bin/env bash
# Copia de seguridad COMPLETA del servidor (todas las bases filanex_*),
# pensada para desastre total: disco roto, servidor corrupto, etc.
#
# Es la segunda capa de seguridad: la primera son las copias por empresa que
# genera la propia aplicación cada noche (descargables desde Ajustes → Copias).
#
# Uso:  ./backup-servidor.sh
# Cron recomendado (crontab -e):
#   15 3 * * * /opt/filanex/nexospro/server/scripts/backup-servidor.sh >> /var/log/filanex-backup.log 2>&1
set -euo pipefail

DESTINO=${BACKUP_SERVIDOR_DIR:-/opt/filanex/backups/mongo}
RETENER_DIAS=${BACKUP_SERVIDOR_RETENER:-7}
SELLO=$(date +%Y%m%d-%H%M%S)

mkdir -p "$DESTINO"

mongodump --uri="${MONGODB_URI_BASE:-mongodb://127.0.0.1:27017}" --gzip \
  --nsExclude 'admin.*' --nsExclude 'config.*' --nsExclude 'local.*' \
  --archive="$DESTINO/mongodump-$SELLO.gz"

find "$DESTINO" -name 'mongodump-*.gz' -mtime +"$RETENER_DIAS" -delete

echo "[backup-servidor] mongodump-$SELLO.gz creado ($(du -h "$DESTINO/mongodump-$SELLO.gz" | cut -f1))"

# Restaurar en caso de desastre:
#   mongorestore --uri="mongodb://127.0.0.1:27017" --gzip --archive=mongodump-XXXX.gz
