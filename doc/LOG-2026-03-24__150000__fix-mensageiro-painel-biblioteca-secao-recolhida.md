# LOG: fix — painel “nome na biblioteca” invisível após salvar Mensageiro

## Problema

Após **Salvar configurações** na seção Mensageiro (IA), o bloco para nomear o produto existia no DOM mas **não aparecia**: o accordion aplicava `dis-section-collapsed` na seção 6, e o CSS oculta `.dis-section-body` (`display: none`). O painel da biblioteca está dentro desse body. Ainda por cima o fluxo **abria a seção 7 (Campanha)**, tirando o foco do passo seguinte.

## Solução

- Se `idx === 5` (Mensageiro) e modo **IA** após save OK: **manter a seção 6 expandida**, **não** avançar automaticamente para Campanha, exibir o painel, `scrollIntoView` e um **toast** orientando nome + “Salvar na biblioteca”.
- Demais seções: comportamento anterior (recolhe e abre a próxima).

## Arquivos

- `index.html` (e `dist/` via build)

## Palavras-chave

- dis-messenger-library-save-wrap, dis-section-collapsed, Mensageiro, accordion disparos
