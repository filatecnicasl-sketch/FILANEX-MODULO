#!/usr/bin/env bash
# setup-servidor.sh — Prepara un Droplet Ubuntu 22.04 limpio para Filanex.
# Ejecutar como root: bash setup-servidor.sh
set -euo pipefail

echo "==> Actualizando sistema"
apt update && apt upgrade -y
apt install -y git curl nginx ufw build-essential gnupg

echo "==> Node.js 20 LTS"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

echo "==> MongoDB 7"
curl -fsSL https://pgp.mongodb.com/server-7.0.asc | gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" > /etc/apt/sources.list.d/mongodb-org-7.0.list
apt update
apt install -y mongodb-org
systemctl enable mongod
systemctl start mongod

echo "==> PM2"
npm install -g pm2
mkdir -p /var/log/filanex
pm2 startup systemd -u root --hp /root || true

echo "==> Firewall"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo "==> Listo. Siguiente paso: clonar el repo y configurar .env (ver deploy/README.md)"
