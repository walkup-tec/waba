# LOG — fix auth anexos chamados (base path)

**Data:** 2026-06-18

## Sintoma
Clique nos ícones de anexo em chamados abertos → `{"error":"Sessão expirada ou não autenticado."}`

## Causa
URLs geradas como `/admin/support/tickets/.../attachments/...` sem `WABA_BASE_PATH` (`/version-02`). Cookie de sessão tem `Path=/version-02`; requisição em `/admin/...` não envia cookie → 401.

## Correção
- `waba-admin-support.service.ts`: prefixo `BASE_PATH` na URL do anexo
- `index.html`: `resolveWabaPublicPath()` nos links de anexo (defesa extra)

## Validar
Master logado em `/version-02/` → clicar ícone de áudio/imagem/vídeo → arquivo abre inline.
