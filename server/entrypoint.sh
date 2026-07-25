#!/bin/sh
set -e

echo "[Hundun] Running database migration..."
npx prisma db push --accept-data-loss

echo "[Hundun] Starting server on port $PORT..."
exec node dist/index.js
