# Capitritus AI — Codespaces

Backend de recomendações do Capitritus usando FastAPI + llama.cpp + Qwen3-0.6B GGUF.

## Por que llama.cpp aqui?

O Codespaces atual usa Linux x86_64/amd64. O build Python do Cactus tentou compilar com flags ARM (`armv8.2-a`) e falhou nesse ambiente. O llama.cpp suporta CPU Linux x86_64 e oferece servidor HTTP compatível com OpenAI.

## Instalação

```bash
cd capitritus-ai
chmod +x bootstrap.sh start.sh
./bootstrap.sh
```

O bootstrap clona e compila apenas o `llama-server`, além de criar `.venv` para o FastAPI.

## Iniciar

```bash
./start.sh
```

Na primeira inicialização, o llama.cpp baixa automaticamente:

```text
Qwen/Qwen3-0.6B-GGUF:Q8_0
```

O GGUF tem aproximadamente 639 MB.

A API pública do Capitritus sobe na porta `8000`; o llama.cpp fica somente em `127.0.0.1:8081`.

## Testar

```bash
curl http://127.0.0.1:8000/health
```

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

## Porta pública no Codespaces

Na aba **PORTS**, localize `8000`, altere **Port Visibility** para **Public** e copie a URL.

## Token opcional

```bash
export CAPITRITUS_API_TOKEN='uma-chave-grande-aqui'
./start.sh
```

O cliente deverá enviar `Authorization: Bearer ...`.

## Modelo

Para trocar o modelo use uma especificação Hugging Face compatível com `llama-server -hf`:

```bash
export CAPITRITUS_MODEL_SPEC='Qwen/Qwen3-0.6B-GGUF:Q8_0'
./start.sh
```

Comece com 0.6B no Codespaces de 2 vCPU. Modelos maiores aumentam bastante a latência.

## Escopo

A API fornece recomendações e explicações curtas. Para respostas abertas, retorna pistas conceituais em vez de uma resposta final pronta para envio.
