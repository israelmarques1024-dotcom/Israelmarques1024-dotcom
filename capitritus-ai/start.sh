#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LLAMA_DIR="$ROOT/llama.cpp"
LLAMA_BIN="$LLAMA_DIR/build/bin/llama-server"
VENV="$ROOT/.venv"
PORT="${PORT:-8000}"
LLAMA_PORT="${LLAMA_PORT:-8081}"
MODEL_SPEC="${CAPITRITUS_MODEL_SPEC:-Qwen/Qwen3-0.6B-GGUF:Q8_0}"

if [ ! -x "$LLAMA_BIN" ] || [ ! -x "$VENV/bin/python" ]; then
  echo "Ambiente incompleto. Rode primeiro: ./bootstrap.sh" >&2
  exit 1
fi

export CAPITRITUS_MODEL_SPEC="$MODEL_SPEC"
export CAPITRITUS_LLAMA_URL="http://127.0.0.1:$LLAMA_PORT"
export PYTHONUNBUFFERED=1

echo "[1/2] Iniciando modelo: $MODEL_SPEC"
echo "      Na primeira vez o GGUF (~639 MB) sera baixado automaticamente."
"$LLAMA_BIN" \
  -hf "$MODEL_SPEC" \
  --alias capitritus \
  --host 127.0.0.1 \
  --port "$LLAMA_PORT" \
  -c 4096 \
  -np 1 \
  -t "$(nproc)" \
  >"$ROOT/llama-server.log" 2>&1 &
LLAMA_PID=$!
trap 'kill "$LLAMA_PID" 2>/dev/null || true' EXIT INT TERM

for _ in $(seq 1 180); do
  if curl -fsS "http://127.0.0.1:$LLAMA_PORT/health" >/dev/null 2>&1; then
    break
  fi
  if ! kill -0 "$LLAMA_PID" 2>/dev/null; then
    echo "llama-server encerrou. Ultimas linhas do log:" >&2
    tail -n 80 "$ROOT/llama-server.log" >&2 || true
    exit 1
  fi
  sleep 1
done

if ! curl -fsS "http://127.0.0.1:$LLAMA_PORT/health" >/dev/null 2>&1; then
  echo "Timeout esperando o modelo iniciar. Veja: $ROOT/llama-server.log" >&2
  exit 1
fi

echo "[2/2] Capitritus AI em 0.0.0.0:$PORT"
cd "$ROOT"
exec "$VENV/bin/python" -m uvicorn app:app --host 0.0.0.0 --port "$PORT" --workers 1
