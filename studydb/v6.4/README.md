# Study Bank Engine v6.4

Motor determinístico com capacidade virtual para **100.000.000 registros de estudo originais**.

## Validação atual

Foi executado um benchmark com **1.000.000 registros**, dividido igualmente:

- 250.000 do 6º ano
- 250.000 do 7º ano
- 250.000 do 8º ano
- 250.000 do 9º ano

Resultados:

- perguntas textualmente únicas: **999.109 / 1.000.000**
- unicidade textual: **99,9109%**
- assinaturas semânticas únicas: **999.770 / 1.000.000**
- unicidade semântica: **99,977%**
- habilidades-base detectadas: **327**
- falhas estruturais: **0**

## Uso

```bash
python study-bank-engine-v6.4.py --id 12345678
python study-bank-engine-v6.4.py --benchmark 100000
python study-bank-engine-v6.4.py --start 25000000 --count 100000 --output chunk.jsonl
```

## Empacotamento

O fonte completo possui 62.057 bytes e foi empacotado em LZMA + Base85 em quatro partes dentro de `payload/`. O loader recompõe o código, verifica o SHA-256 `4e938c47c2eb680a0e0ca24b78cab425a37c583c28c03bc5a88b3f6f6035b8d5` e só então executa o motor.

## Métricas

`questionHash` mede duplicatas textuais exatas.

`semanticSignature` inclui série, matéria, tópico, família e parâmetros significativos da instância.

`coreSkillSignature` mede a habilidade/família-base, sem tratar simples troca de números como uma nova habilidade.

## Limite importante

A capacidade virtual é de 100 milhões. O benchmark atual valida 1 milhão de registros; ele não significa que 100 milhões foram materializados em disco nem revisados individualmente por humanos.
