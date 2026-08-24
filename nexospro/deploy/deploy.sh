#!/usr/bin/env bash
# deploy.sh — Actualiza la app en el servidor desde GitHub.
# Uso: bash /opt/filanex/nexospro/deploy/deploy.sh
set -euo pipefail

APP_DIR=/opt/filanex

cd "$APP_DIR"
echo "==> Descargando últimos cambios"
git pull origin main

echo "==> Backend: dependencias"
cd "$APP_DIR/nexospro/server"
npm install --omit=dev

echo "==> Frontend: build"
cd "$APP_DIR/nexospro/client"
npm install
npm run build

echo "==> Reiniciando API"
pm2 restart filanex-api

echo "==> Despliegue completado"
pm2 status
