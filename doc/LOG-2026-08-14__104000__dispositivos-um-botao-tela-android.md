# LOG — Dispositivos: um botão e a tela do Android

## Contexto

A aba Aquecedor → Dispositivos embutia a UI completa do Device Cloud (SSO, nome, criar celular, iframe). O usuário via “SSO token inválido” e não conseguia usar o Android.

Pedido: um único botão **Criar Dispositivo**; o emulado aparece na tela; o restante fica no backend.

## Solução

O browser do WABA não fala mais com `devices.draxsistemas.com.br`.

1. `POST /device-cloud/device` — SSO HMAC servidor→API AWS, reusa o Android ONLINE se existir, senão cria.
2. `GET /device-cloud/device/:id/screenshot` e `POST .../input/*` — proxy autenticado.
3. Aba Dispositivos: botão + tela clicável (toque/swipe) + Voltar/Início.

API usada: `https://api-devices.draxsistemas.com.br` (não a URL da UI).

## Marker

`DEPLOY-2026-08-14-device-cloud-one-button`

## Como validar

Após Redeploy EasyPanel: Dispositivos → Criar Dispositivo → tela do Android. Sem iframe Device Cloud e sem “SSO token inválido”.
