# Capitritus AI — Codespaces

Backend local de IA para o Capitritus usando FastAPI + Cactus + Qwen3-0.6B.

## Instalação no Codespaces

No terminal, a partir da raiz do repositório:

```bash
cd capitritus-ai
chmod +x bootstrap.sh start.sh
./bootstrap.sh
```

O bootstrap segue o setup Linux oficial do Cactus, compila as bindings Python e baixa `Qwen/Qwen3-0.6B`.

## Iniciar

```bash
cd capitritus-ai
./start.sh
```

A API sobe na porta `8000`.

### Teste local

```bash
curl http://127.0.0.1:8000/health
```

Exemplo de recomendação:

```bash
curl -X POST http://127.0.0.1:8000/solve \
  -H 'Content-Type: application/json' \
  -d '{
    "kind":"multiple_choice",
    "subject":"Ciências",
    "question":"Qual fator é abiótico?",
    "options":["Peixes","Algas","Luz","Bactérias"]
  }'
```

## URL pública no Codespaces

Na aba **PORTS**, localize `8000`, mude **Port Visibility** para **Public** e copie a URL. O formato normal é:

```text
https://NOME-DO-CODESPACE-8000.app.github.dev
```

## Token opcional

Antes de iniciar:

```bash
export CAPITRITUS_API_TOKEN='uma-chave-grande-aqui'
./start.sh
```

Nesse caso o cliente precisa enviar:

```http
Authorization: Bearer uma-chave-grande-aqui
```

## Trocar o modelo

```bash
export CAPITRITUS_MODEL='LiquidAI/LFM2.5-1.2B-Instruct'
./bootstrap.sh
./start.sh
```

Comece com Qwen3-0.6B para reduzir RAM e latência na CPU do Codespaces.

## Limite de uso

A API gera recomendações e pistas. Para respostas abertas, ela retorna apenas pistas conceituais, não uma resposta final pronta para envio.
