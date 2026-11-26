#!/usr/bin/env bash
# Respaldo diario de PUPE: base de datos y variables de entorno. Guarda 14 días.
# Instalar: sudo cp deploy/backup.sh /usr/local/bin/pupe-backup && sudo chmod 700 /usr/local/bin/pupe-backup
# Cron (sudo crontab -e):  30 3 * * * /usr/local/bin/pupe-backup
set -euo pipefail
umask 077
DIR=/var/backups/pupe
STAMP=$(date +%F-%H%M)
mkdir -p "$DIR" && chmod 700 "$DIR"
sudo -u postgres pg_dump -Fc pupe > "$DIR/pupe-$STAMP.dump"
# Las variables (llaves de Turnstile y SMTP) no viven en PostgreSQL.
cp /etc/pupe/pupe.env "$DIR/pupe-env-$STAMP"
find "$DIR" -name 'pupe-*' -mtime +14 -delete
echo "Respaldo listo: $DIR/pupe-$STAMP.dump"
