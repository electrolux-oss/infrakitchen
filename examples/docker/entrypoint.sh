#!/bin/bash

if [[ "${POSTGRES_MIGRATIONS,,}" == "true" ]]; then
  echo "Running migrations..."
  alembic -c alembic.ini upgrade head &&
    service nginx start && exec uvicorn app:app --host 0.0.0.0 --port 8000 --log-config application/logger/uvicorn_logging.json --ws websockets-sansio
else
  echo "Skipping migrations as POSTGRES_MIGRATIONS is set to false."
  service nginx start && exec uvicorn app:app --host 0.0.0.0 --port 8000 --log-config application/logger/uvicorn_logging.json --ws websockets-sansio
fi
