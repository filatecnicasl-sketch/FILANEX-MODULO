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

# Si el .env del servidor define la carpeta o la retención, manda sobre el
# valor por defecto (así se elige la carpeta sin tocar el script ni el cron).
ENV_FILE="$(cd "$(dirname "$0")/.." && pwd)/.env"
if [ -f "$ENV_FILE" ]; then
  DIR_ENV=$(grep -E '^BACKUP_SERVIDOR_DIR=' "$ENV_FILE" | tail -1 | cut -d= -f2- | tr -d "\"'\r" || true)
  if [ -n "$DIR_ENV" ]; then DESTINO="$DIR_ENV"; fi
  RET_ENV=$(grep -E '^BACKUP_SERVIDOR_RETENER=' "$ENV_FILE" | tail -1 | cut -d= -f2- | tr -d "\"'\r" || true)
  if [ -n "$RET_ENV" ]; then RETENER_DIAS="$RET_ENV"; fi
fi

SELLO=$(date +%Y%m%d-%H%M%S)

mkdir -p "$DESTINO"

mongodump --uri="${MONGODB_URI_BASE:-mongodb://127.0.0.1:27017}" --gzip \
  --archive="$DESTINO/mongodump-$SELLO.gz"

find "$DESTINO" -name 'mongodump-*.gz' -mtime +"$RETENER_DIAS" -delete

echo "[backup-servidor] mongodump-$SELLO.gz creado ($(du -h "$DESTINO/mongodump-$SELLO.gz" | cut -f1))"

# Restaurar en caso de desastre (solo las bases de la aplicación):
#   mongorestore --uri="mongodb://127.0.0.1:27017" --gzip \
#     --nsInclude 'filanex*' --archive=mongodump-XXXX.gz
