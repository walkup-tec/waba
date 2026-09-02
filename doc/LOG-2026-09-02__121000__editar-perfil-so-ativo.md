# LOG — Editar perfil só com número Ativo

## Contexto

A Meta só aceita foto/nome de perfil em número CONNECTED. O card Pendente ainda mostrava Editar perfil.

## Solução

- **Editar perfil** e clique na foto só no card **Ativo**.
- Pendente: foto sem clique; só PIN + Ativar.
- Abrir/salvar o modal recusa se `uiStatus !== ativo`.
- Backend já lança `phone_not_registered`.

## Como validar

Número Pendente: sem botão Editar perfil. Número Ativo: botão e clique na foto.

Marker: `DEPLOY-2026-09-02-121000-editar-perfil-so-ativo`

## Palavras-chave

Editar perfil, Ativo, Pendente, phone_not_registered
