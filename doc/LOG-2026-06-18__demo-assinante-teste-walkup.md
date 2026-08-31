# Demo — assinante.teste@walkup.com

**Data:** 2026-06-18

## Pedido
Ativar assinante para apresentação: primeiro acesso, sem contratações.

## Executado
Script: `node scripts/prepare-demo-subscriber-v02.cjs assinante.teste@walkup.com Walkup@2026`

- `createdAt` / `updatedAt` → agora (aparece como cadastro novo no master)
- Senha demo definida
- Sem pedidos, créditos, campanhas, chamados ou instâncias vinculadas

## Login demo
| Campo | Valor |
|-------|-------|
| E-mail | assinante.teste@walkup.com |
| Senha | Walkup@2026 |
| URL | http://localhost:3012/version-02/ |

## Estado esperado na apresentação
- Saldo disparos: **0**
- Campanhas: **nenhuma**
- Aquecedor: **bloqueado** (precisa contratar PIX)
- Master → Assinantes: badge **1** (cadastro após última visita)

## Dica
Abrir aba anônima ou limpar `localStorage` do domínio para simular primeiro acesso visual no browser.
