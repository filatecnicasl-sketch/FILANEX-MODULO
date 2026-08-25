#!/bin/bash
JWT=$(openssl rand -hex 48)
CERTS=$(openssl rand -hex 48)
cat > /opt/filanex/nexospro/server/.env <<EOF
PORT=4700
MONGODB_URI_BASE=mongodb://localhost:27017
BD_PLATAFORMA=filanex_plataforma
PREFIJO_BD=filanex_
JWT_SECRET=$JWT
CLAVE_CERTS=$CERTS
FRONTEND_URL=https://app.filanex.es
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.6-flash
SIF_NOMBRE_RAZON=FILA TECNICA SL
SIF_NIF=B75418350
SIF_ID=NP
SIF_VERSION=0.1.0
SIF_NUM_INSTALACION=1
AEAT_ENTORNO=pruebas
AEAT_CERT_PFX=
AEAT_CERT_PASS=
EOF
chmod 600 /opt/filanex/nexospro/server/.env
echo "ENV creado"
