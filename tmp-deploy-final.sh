#!/usr/bin/env bash
set -euo pipefail
cd /opt/filanex
git pull origin main
bash deploy/deploy.sh
