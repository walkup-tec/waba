# LOG — V01 local login não configurado

**Data:** 2026-06-19  
**Contexto:** Ambiente V01 (`http://localhost:3011/version-01/`) exibia «Login não configurado. Defina WABA_ADMIN_EMAIL e WABA_ADMIN_PASSWORD no Easypanel».

## Causa

`.env.v01` não tinha variáveis de autenticação; `.env.v02` já tinha.

## Alterações

- `.env.v01` — adicionadas credenciais admin + session secret (arquivo gitignored, não commitado)
- `.env.v01.example` — placeholders de auth documentados

## Comandos

```powershell
cd D:\Waba
powershell -File scripts/free-port.ps1 -Port 3011
npm run dev:v01
```

## Validação

- `GET http://localhost:3011/version-01/auth/session` → `{"authConfigured":true,...}`
- `POST /version-01/auth/login` com credenciais do `.env.v01` → `200`, `role: master`

## Pendências

Nenhuma para este item.
