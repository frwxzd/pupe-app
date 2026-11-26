#!/usr/bin/env bash
# PostgreSQL local para desarrollo y pruebas, dentro del proyecto (.pgdata).
# No usa sudo ni toca el PostgreSQL del sistema. Escucha solo en 127.0.0.1:5433.
#   ./scripts/db-local.sh start | stop | status
set -euo pipefail
cd "$(dirname "$0")/.."
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
DATA=".pgdata"
PORT="${PGPORT_LOCAL:-5433}"

case "${1:-start}" in
  start)
    if [ ! -f "$DATA/PG_VERSION" ]; then
      "$PGBIN/initdb" -D "$DATA" -U pupe --auth=trust --encoding=UTF8 --locale=C.UTF-8 >/dev/null
      echo "Base creada en $DATA"
    fi
    if "$PGBIN/pg_ctl" -D "$DATA" status >/dev/null 2>&1; then
      echo "PostgreSQL ya está corriendo en el puerto $PORT"
    else
      "$PGBIN/pg_ctl" -D "$DATA" -l "$DATA/server.log" -w \
        -o "-p $PORT -k $PWD/$DATA -c listen_addresses=127.0.0.1" start >/dev/null
      echo "PostgreSQL iniciado en 127.0.0.1:$PORT"
    fi
    for db in pupe pupe_test; do
      "$PGBIN/psql" -h 127.0.0.1 -p "$PORT" -U pupe -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$db'" | grep -q 1 \
        || "$PGBIN/createdb" -h 127.0.0.1 -p "$PORT" -U pupe "$db"
    done
    ;;
  stop) "$PGBIN/pg_ctl" -D "$DATA" stop ;;
  status) "$PGBIN/pg_ctl" -D "$DATA" status ;;
  *) echo "Uso: $0 start|stop|status"; exit 1 ;;
esac
