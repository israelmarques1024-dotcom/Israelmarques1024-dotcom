#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CACTUS_DIR="$ROOT/cactus"
PORT="${PORT:-8000}"

if [ ! -d "$CACTUS_DIR" ]; then
  echo "Cactus nao encontrado. Rode primeiro: ./bootstrap.sh" >&2
  exit 1
fi

cd "$CACTUS_DIR"
if [ -f "venv/bin/activate" ]; then
  source venv/bin/activate
else
  source ./setup
fi

cd "$ROOT"
export PYTHONUNBUFFERED=1

echo "Capitritus AI iniciando em 0.0.0.0:$PORT"
python -m uvicorn app:app --host 0.0.0.0 --port "$PORT" --workers 1
