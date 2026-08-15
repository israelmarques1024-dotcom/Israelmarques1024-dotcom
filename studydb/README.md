# StudyDB / Doritus Ultra

Este diretório reúne o userscript **Doritus Ultra v1.0.0** e o **Study Bank Engine v6.4**, um motor determinístico de material de estudo com capacidade virtual de **100.000.000 de registros**.

## Versão atual

A versão principal agora é `v6.4/`.

O benchmark publicado validou **1.000.000 de registros**, com 250.000 amostras de cada série (6º, 7º, 8º e 9º ano):

- **999.109** perguntas textualmente únicas — **99,9109%**
- **999.770** assinaturas semânticas únicas — **99,977%**
- **327** habilidades/famílias-base detectadas
- **0** falhas estruturais no validador

O relatório completo está em `v6.4/validation-report.json`.

## Estrutura

- `doritus-studydb.user.js` — userscript Doritus Ultra v1.0.0.
- `answers.json` — banco JSON pequeno mantido no repositório.
- `v6.4/study-bank-engine-v6.4.py` — loader da versão atual.
- `v6.4/payload/` — quatro partes Base85/LZMA contendo o fonte completo da v6.4.
- `v6.4/manifest.json` — integridade, capacidade e dados do benchmark.
- `v6.4/validation-report.json` — relatório de validação de 1 milhão de registros.
- `v6.4/sample.json` — exemplos das quatro séries.
- `study-bank-engine-v5.py` — versão anterior, preservada para histórico/compatibilidade.
- `study-bank-100m-generator.py` — entrypoint legado.
- `datasets/README.md` — estratégia de materialização de datasets grandes.

## Cobertura virtual

- 6º ano — 25.000.000 IDs
- 7º ano — 25.000.000 IDs
- 8º ano — 25.000.000 IDs
- 9º ano — 25.000.000 IDs

Matérias: Matemática, Língua Portuguesa, Ciências, História, Geografia, Inglês e Programação.

## Gerar um registro

```bash
cd studydb/v6.4
python study-bank-engine-v6.4.py --id 12345678
```

## Rodar benchmark

```bash
python study-bank-engine-v6.4.py --benchmark 100000
```

## Exportar um bloco

```bash
python study-bank-engine-v6.4.py \
  --start 25000000 \
  --count 100000 \
  --output 7ano-100k.jsonl
```

## Integridade

O fonte original da v6.4 possui **62.057 bytes** e SHA-256:

```text
4e938c47c2eb680a0e0ca24b78cab425a37c583c28c03bc5a88b3f6f6035b8d5
```

O loader junta as quatro partes em `v6.4/payload/`, descomprime o fonte e verifica esse hash antes de executar.

## Sobre os 100 milhões

Os 100 milhões representam a **capacidade virtual determinística** do motor. Eles não ficam materializados em um único JSON, porque isso ocuparia dezenas de GB. O benchmark atual validou uma amostra de 1 milhão distribuída pelas quatro séries; ele não significa que todos os 100 milhões foram revisados individualmente por humanos.

## Doritus Ultra

O userscript continua separado do Study Bank Engine. Alterações no motor não modificam automaticamente o Gist ou o `answers.json` usado pelo Doritus.

## Segurança

Não coloque senhas, tokens, cookies, chaves de API ou outros segredos em `answers.json`, Gists públicos ou arquivos gerados.
