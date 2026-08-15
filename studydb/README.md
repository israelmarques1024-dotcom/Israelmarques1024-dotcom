# StudyDB / Doritus Ultra

Este diretório reúne o userscript **Doritus Ultra v1.0.0** e o **Study Bank Engine v5.1**, um gerador determinístico de material de estudo com capacidade virtual de **100.000.000 de registros**.

## Estrutura

- `doritus-studydb.user.js` — userscript Doritus Ultra v1.0.0.
- `answers.json` — banco JSON pequeno mantido no repositório.
- `study-bank-engine-v5.py` — motor principal do banco virtual de 100 milhões.
- `study-bank-100m-generator.py` — entrypoint de compatibilidade que encaminha para o motor v5.
- `study-bank-100m-manifest.json` — metadados, capacidade e comandos principais.
- `study-bank-v5-catalog.json` — catálogo de séries, matérias e tópicos.
- `study-bank-v5-sample.json` — amostra de registros gerados.
- `test-study-bank-engine.py` — testes básicos de limites, schema e determinismo.
- `datasets/README.md` — estratégia para gerar snapshots grandes sem versionar dezenas de GB.

## Cobertura

O banco virtual é dividido igualmente entre:

- 6º ano — 25.000.000 IDs
- 7º ano — 25.000.000 IDs
- 8º ano — 25.000.000 IDs
- 9º ano — 25.000.000 IDs

Matérias: Matemática, Língua Portuguesa, Ciências, História, Geografia, Inglês e Programação.

## Gerar um registro

```bash
python study-bank-engine-v5.py --id 12345678
```

## Validar o motor

```bash
python study-bank-engine-v5.py --validate 20000
python test-study-bank-engine.py
```

## Ver o catálogo

```bash
python study-bank-engine-v5.py --catalog
```

## Gerar um banco por série

```bash
python study-bank-engine-v5.py \
  --grade 7 \
  --count 100000 \
  --output 7ano-100k.jsonl
```

## Filtrar por matéria

```bash
python study-bank-engine-v5.py \
  --grade 7 \
  --subject "Matemática" \
  --count 100000 \
  --output matematica-7ano.jsonl
```

## Gerar SQLite

```bash
python study-bank-engine-v5.py \
  --grade 7 \
  --count 100000 \
  --sqlite 7ano.sqlite
```

## Por que os 100 milhões não ficam em um JSON?

Um arquivo materializado nessa escala ocuparia dezenas de GB e seria ruim para Git, download e atualização. Por isso o projeto usa geração procedural determinística: um mesmo ID gera sempre o mesmo registro. Bancos menores podem ser exportados em JSONL, JSON ou SQLite quando necessário.

## Doritus Ultra

O userscript atual continua separado do Study Bank Engine. Ele mantém a configuração de Gist definida dentro de `doritus-studydb.user.js`. Alterar o gerador v5 não altera automaticamente o conteúdo desse Gist.

## Segurança

Não coloque senhas, tokens, cookies, chaves de API ou outros segredos em `answers.json`, Gists públicos ou arquivos gerados.
