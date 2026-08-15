# StudyDB

Assistente de estudo em userscript para Tampermonkey.

## Arquivos

- `doritus-studydb.user.js` — userscript principal.
- `answers.json` — banco remoto de estudo.

## Como funciona

O script detecta questões nas plataformas suportadas, gera um SHA-256 do texto normalizado e consulta primeiro o banco local (`localStorage`) e depois este `answers.json`.

Ele não clica, não envia respostas e não simula comportamento humano.

## Instalação

Abra `doritus-studydb.user.js` no GitHub em modo Raw. Com Tampermonkey instalado, o navegador deve oferecer a instalação do userscript.

## Sincronização

Novos registros são salvos localmente. O botão **Exportar JSON** gera um `answers.json` mesclado com o conteúdo remoto. Para publicar novos registros no banco remoto, substitua `studydb/answers.json` no repositório pelo JSON exportado.

## Segurança

Não armazene senhas, tokens, cookies, chaves de API ou outros segredos no `answers.json`.
