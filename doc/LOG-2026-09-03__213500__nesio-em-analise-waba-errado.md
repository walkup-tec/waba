# LOG — nesio_* Em análise no Lab, ausente no Manager Jandira

## Sintoma

Lab (portfólio **Quantum Smart Labs**): `nesio_1/2/3` status **Em análise**, sync 03/09 18:30, rodapé `Sincronizado, páginas=6. Removidos da Meta=6`.

WhatsApp Manager aberto em **Relacionamento Jandira Feghali**: só `gov_am_drax_*` e `jandira_quantun_*` (Ativo). Sem `nesio_*`.

## Hipótese principal

Contas/WABA diferentes. O envio e o sync do Lab foram no WABA do portfólio **Quantum Smart Labs**. O Manager na captura é outra conta (Jandira). PENDING também não aparece na lista filtrada só de **Ativo**.

Confiança: **alta** (print Lab vs print Manager + LOG 2026-09-02 mesmo padrão).

## O que fazer (operacional)

1. No Manager Meta, trocar para o WABA/portfólio **Quantum Smart Labs** (mesmo da sessão Lab).
2. Tirar filtro só “Ativo”; olhar **Em análise / Pendente**.
3. No Lab: anotar `wabaId` do card Quantum Smart Labs e conferir se bate com a conta aberta na Meta.

## Código

Sem bug novo identificado no fluxo: `create` → Graph `message_templates` → status PENDING; sync lista o mesmo `wabaId` da connection.

## Palavras-chave

nesio, Quantum Smart Labs, Jandira Feghali, WABA errado, PENDING, Em análise
