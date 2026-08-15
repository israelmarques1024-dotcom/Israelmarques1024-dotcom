#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LLAMA_DIR="$ROOT/llama.cpp"
VENV="$ROOT/.venv"

echo "[1/4] Instalando dependencias do sistema..."
sudo apt-get update
sudo apt-get install -y python3 python3-venv python3-pip cmake build-essential git curl libcurl4-openssl-dev

if [ ! -d "$LLAMA_DIR/.git" ]; then
  echo "[2/4] Clonando llama.cpp..."
  git clone --depth 1 https://github.com/ggml-org/llama.cpp "$LLAMA_DIR"
else
  echo "[2/4] llama.cpp ja existe; atualizando..."
  git -C "$LLAMA_DIR" pull --ff-only || true
fi

echo "[3/4] Compilando llama-server para $(uname -m)..."
cmake -S "$LLAMA_DIR" -B "$LLAMA_DIR/build" -DCMAKE_BUILD_TYPE=Release
cmake --build "$LLAMA_DIR/build" --config Release -j"$(nproc)" --target llama-server

echo "[4/4] Preparando API Python..."
python3 -m venv "$VENV"
"$VENV/bin/python" -m pip install --upgrade pip
"$VENV/bin/python" -m pip install 'fastapi>=0.115' 'uvicorn[standard]>=0.34' 'pydantic>=2.10'

echo
echo "Pronto. O modelo sera baixado automaticamente na primeira inicializacao."
echo "Modelo padrao: Qwen/Qwen3-0.6B-GGUF:Q8_0 (~639 MB)"
echo "Agora rode:"
echo "  cd $ROOT"
echo "  ./start.sh"
