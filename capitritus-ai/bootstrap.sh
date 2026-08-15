#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CACTUS_DIR="$ROOT/cactus"
MODEL="${CAPITRITUS_MODEL:-Qwen/Qwen3-0.6B}"

echo "[1/5] Instalando dependencias do sistema..."
sudo apt-get update
sudo apt-get install -y python3.12 python3.12-venv python3-pip cmake build-essential libcurl4-openssl-dev git curl

if [ ! -d "$CACTUS_DIR/.git" ]; then
  echo "[2/5] Clonando Cactus..."
  git clone --depth 1 https://github.com/cactus-compute/cactus "$CACTUS_DIR"
else
  echo "[2/5] Cactus ja existe; atualizando..."
  git -C "$CACTUS_DIR" pull --ff-only || true
fi

cd "$CACTUS_DIR"
echo "[3/5] Preparando Cactus..."
# O setup oficial cria/ativa o ambiente Python do Cactus.
source ./setup
cactus build --python

# FastAPI deve ficar no mesmo ambiente Python usado pelo Cactus.
echo "[4/5] Instalando API..."
python -m pip install --upgrade pip
python -m pip install 'fastapi>=0.115' 'uvicorn[standard]>=0.34' 'pydantic>=2.10'

echo "[5/5] Baixando modelo: $MODEL"
cactus download "$MODEL"

echo
echo "Pronto. Para iniciar:"
echo "  cd $ROOT"
echo "  ./start.sh"
echo
echo "Depois abra a aba PORTS do Codespaces e torne a porta 8000 PUBLICA."
