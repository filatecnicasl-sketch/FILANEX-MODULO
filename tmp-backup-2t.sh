#!/bin/sh
set -e
mkdir -p /opt/filanex/backups/mongo
stamp=$(date -u +%Y%m%dT%H%M%SZ)
archive="/opt/filanex/backups/mongo/filanex-local-pre-import-2t-$stamp.gz"
mongodump --uri=mongodb://127.0.0.1:27017/filanex_local --gzip --archive="$archive"
sha256sum "$archive"
ls -lh "$archive"
