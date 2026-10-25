#!/bin/sh
set -e
cd /opt/filanex/server
mkdir -p /opt/filanex/backups/mongo
BACKUP="/opt/filanex/backups/mongo/filanex-local-pre-import-comisiones-20261024-$(date +%H%M%S).archive.gz"
mongodump --uri=mongodb://127.0.0.1:27017/filanex_local --archive="$BACKUP" --gzip
sha256sum "$BACKUP" > "$BACKUP.sha256"
echo "BACKUP=$BACKUP"
cat "$BACKUP.sha256"
node tmp-importar-historicas-comisiones.mjs --apply
curl -fsS http://127.0.0.1:4700/api/health
