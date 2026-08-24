# Despliegue de Filanex en DigitalOcean

Guía paso a paso para poner la app en producción en `app.filanex.es` (+`api.filanex.es`).

## 1. Crear el Droplet

- En DigitalOcean: **Create → Droplets**.
- Imagen: **Ubuntu 22.04 (LTS) x64**.
- Plan: **Basic 4 GB / 2 vCPU / 80 GB SSD** (~24 $/mes). Suficiente para las primeras instalaciones; se escala con un clic.
- Región: **Frankfurt (FRA1)**.
- Autenticación: **SSH key** (recomendado) o contraseña root.
- Activa **Backups** (+20 %).
- Hostname: `filanex-prod`.

## 2. DNS (donde gestiones filanex.es)

Crea dos registros **A** apuntando a la IP del Droplet:

| Tipo | Nombre | Valor |
|---|---|---|
| A | `app` | IP del Droplet |
| A | `api` | IP del Droplet |

## 3. Preparar el servidor

```bash
ssh root@IP_DEL_DROPLET
curl -O https://raw.githubusercontent.com/filatecnicasl-sketch/FILANEX-MODULO/main/nexospro/deploy/setup-servidor.sh
bash setup-servidor.sh
```

## 4. Clonar y configurar

```bash
cd /opt
git clone https://github.com/filatecnicasl-sketch/FILANEX-MODULO.git filanex
cd filanex/nexospro/server
cp .env.example .env
nano .env
```

Valores mínimos en `.env`:

```env
PORT=4700
MONGODB_URI_BASE=mongodb://127.0.0.1:27017
BD_PLATAFORMA=filanex_plataforma
PREFIJO_BD=filanex_
JWT_SECRET=<clave aleatoria larga>
CLAVE_CERTS=<otra clave aleatoria larga>
FRONTEND_URL=https://app.filanex.es
```

Genera claves con: `openssl rand -hex 48`

## 5. Dependencias y build

```bash
cd /opt/filanex/nexospro/server && npm install --omit=dev
cd /opt/filanex/nexospro/client && npm install && npm run build
```

## 6. Nginx + HTTPS

```bash
cp /opt/filanex/nexospro/deploy/nginx-filanex.conf /etc/nginx/sites-available/filanex
ln -s /etc/nginx/sites-available/filanex /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

apt install -y certbot python3-certbot-nginx
certbot --nginx -d app.filanex.es -d api.filanex.es
```

## 7. Arrancar con PM2

```bash
cd /opt/filanex/nexospro/server
pm2 start ecosystem.config.cjs
pm2 save
```

## 8. Backups automáticos

```bash
chmod +x /opt/filanex/nexospro/deploy/*.sh
crontab -e
# Añade:
# 0 3 * * * bash /opt/filanex/nexospro/deploy/backup-mongo.sh >> /var/log/filanex/backup.log 2>&1
```

## 9. Crear el primer superadmin

```bash
cd /opt/filanex/nexospro/server
# Opción A: registro inicial (solo funciona si no hay ninguna cuenta)
curl -X POST https://app.filanex.es/api/auth/registro-inicial \
  -H "Content-Type: application/json" \
  -d '{"slug":"filatecnica","nombre":"Filatecnica S.L.","email":"fbarroso@filatecnica.com","password":"CLAVE_SEGURA"}'
```

## 10. Actualizaciones futuras

```bash
bash /opt/filanex/nexospro/deploy/deploy.sh
```

## Escalado según crecimiento

| Situación | Acción |
|---|---|
| 2-10 clientes | Droplet 4 GB (actual) |
| 10-30 clientes | Resize a 8 GB (~48 $/mes) sin reinstalar nada |
| +30 clientes o alta criticidad | MongoDB gestionado (Atlas M10) + segundo Droplet |
