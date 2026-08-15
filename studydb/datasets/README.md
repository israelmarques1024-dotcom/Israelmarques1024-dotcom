# Datasets

Os bancos grandes são gerados sob demanda pelo `study-bank-engine-v5.py`.

Não é necessário versionar arquivos JSON gigantes: o motor é determinístico e pode gerar novamente os mesmos IDs sempre que necessário.

## Tamanhos usados durante o desenvolvimento

- v1: 2.909 registros
- v2: 11.600 registros
- v3: 50.000 registros
- v5: capacidade virtual de 100.000.000 registros

## Gerar snapshots equivalentes

```bash
python ../study-bank-engine-v5.py --count 2909 --output study-bank-2909.jsonl
python ../study-bank-engine-v5.py --count 11600 --output study-bank-11600.jsonl
python ../study-bank-engine-v5.py --count 50000 --output study-bank-50000.jsonl
```

## Gerar por série

```bash
python ../study-bank-engine-v5.py --grade 6 --count 100000 --output 6ano.jsonl
python ../study-bank-engine-v5.py --grade 7 --count 100000 --output 7ano.jsonl
python ../study-bank-engine-v5.py --grade 8 --count 100000 --output 8ano.jsonl
python ../study-bank-engine-v5.py --grade 9 --count 100000 --output 9ano.jsonl
```

## SQLite

```bash
python ../study-bank-engine-v5.py --grade 7 --count 100000 --sqlite 7ano.sqlite
```

Arquivos `.jsonl`, `.sqlite`, `.db` e `.gz` são ignorados pelo Git porque são artefatos gerados e podem ser recriados pelo motor.
