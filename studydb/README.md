# StudyDB / Doritus Ultra

Este diretório reúne o **Doritus Ultra Study 2.0.0**, o userscript legado `doritus-studydb.user.js` e o **Study Bank Engine v6.4**.

## Instalação final no Tampermonkey

Abra a URL Raw abaixo em um navegador com Tampermonkey compatível:

```text
https://raw.githubusercontent.com/israelmarques1024-dotcom/Israelmarques1024-dotcom/main/studydb/doritus-ultra-study.user.js
```

O instalador possui `@updateURL` e `@downloadURL` apontando para a mesma URL, permitindo atualizações futuras pelo Tampermonkey.

## Doritus Ultra Study 2.0.0

A versão para navegador reúne em uma única instalação:

- banco virtual de **100.000.000 IDs** gerados sob demanda;
- 6º, 7º, 8º e 9º ano;
- Matemática, Língua Portuguesa, Ciências, História, Geografia, Inglês e Programação;
- seleção por série e matéria;
- geração por ID ou aleatória;
- dica, resposta e explicação;
- histórico local;
- funcionamento com cache após o primeiro carregamento bem-sucedido;
- verificação SHA-256 do bundle antes da execução.

O userscript principal é `doritus-ultra-study.user.js`. Para manter o instalador pequeno, o código completo fica dividido em cinco arquivos dentro de `ultra/`; o loader baixa as partes, junta o bundle, confere o SHA-256 e salva uma cópia em cache local.

SHA-256 esperado do bundle:

```text
79c5ea733fb601009d38a8d1434abe8179419fba8ebb6e17b596c14db6be1ddd
```

Consulte `ultra/manifest.json` para tamanhos e hashes de cada parte.

## Study Bank Engine v6.4

O motor Python continua preservado como versão de pesquisa/validação. Ele tem capacidade virtual de **100.000.000 de registros** e o benchmark publicado validou **1.000.000 de registros**, distribuídos igualmente entre 6º, 7º, 8º e 9º ano:

- **999.109** perguntas textualmente únicas — **99,9109%**;
- **999.770** assinaturas semânticas únicas — **99,977%**;
- **327** habilidades/famílias-base detectadas;
- **0** falhas estruturais no validador.

O relatório completo está em `v6.4/validation-report.json`.

## Estrutura

- `doritus-ultra-study.user.js` — instalador final do Tampermonkey.
- `ultra/part-00.txt` … `part-04.txt` — bundle JavaScript do Doritus Ultra Study.
- `ultra/manifest.json` — integridade e metadados do bundle.
- `doritus-studydb.user.js` — userscript legado v1.0.0.
- `answers.json` — banco JSON legado pequeno.
- `v6.4/study-bank-engine-v6.4.py` — loader do motor Python v6.4.
- `v6.4/payload/` — fonte compactado da v6.4.
- `v6.4/manifest.json` — integridade e capacidade da v6.4.
- `v6.4/validation-report.json` — benchmark de 1 milhão de registros.
- `v6.4/sample.json` — exemplos das quatro séries.
- `datasets/README.md` — estratégia para materializar datasets grandes.

## Cobertura virtual

- 6º ano — 25.000.000 IDs
- 7º ano — 25.000.000 IDs
- 8º ano — 25.000.000 IDs
- 9º ano — 25.000.000 IDs

Total: **100.000.000 IDs virtuais**.

## Importante sobre os 100 milhões

Os 100 milhões são uma **capacidade virtual determinística**: os registros são gerados quando solicitados. Eles não ficam todos salvos em um único arquivo. A versão Python v6.4 possui o benchmark de diversidade publicado; a versão JavaScript para Tampermonkey é um motor próprio para uso no navegador e não deve ser tratada como uma cópia bit a bit do Python.

## Uso

O Doritus Ultra Study funciona como **assistente de estudo/manual**: ele gera material, mostra dicas, respostas e explicações quando solicitado pelo usuário. Ele não envia atividades nem clica automaticamente em plataformas educacionais.

## Segurança

Não coloque senhas, tokens, cookies, chaves de API ou outros segredos em arquivos públicos, Gists ou bancos exportados.
