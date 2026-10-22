#!/usr/bin/env bash
set -euo pipefail
cd /opt/filanex/nexospro
git pull origin main
bash deploy/deploy.sh
