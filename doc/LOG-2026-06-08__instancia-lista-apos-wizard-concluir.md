# LOG — Instância só na tabela após wizard concluir

**Data:** 2026-06-08  
**Pedido:** A instância só deve aparecer na listagem após o modal fechar, quando todas as etapas de verificação forem finalizadas.

## Alterações

**Arquivo:** `index.html` (copiado para `dist/` no build)

- Variáveis `registerWizardHideInstanceName` e `registerWizardValidationComplete`
- `shouldHideInstanceFromRegisterWizard()` — filtra instância em `buildOrderedInstancesBase()` enquanto:
  - modal aberto, ou
  - validação ainda não marcada como completa
- `beginRegisterWizardHide()` — ao gerar QR e ao conectar (`open`)
- `markRegisterWizardValidationComplete()` — em `finishRegisterWizardSuccess()` (passo 4)
- `closeRegisterModal()` — chama `carregar()` só se validação completa + usuário clicou **Concluir**; cancelar/pular re-renderiza sem `carregar()` completo
- Removidos `carregar()` intermediários durante QR/conexão/validação no fluxo de registro

## Comportamento esperado

| Momento | Tabela |
|---------|--------|
| Gerando QR / escaneando / validando | Instância **oculta** |
| Passo 4 (Pronto) com modal aberto | **Oculta** |
| Clicar **Concluir** | Modal fecha → `carregar()` → **visível** |
| Cancelar ou pular validação | Modal fecha → instância **visível** (flags limpas) |

## Build

```powershell
cd D:\Waba
npm run build
```

## Pendências

- Testar fluxo completo em `npm run dev:v02`
- Corrigir `Bad Request` no `sendText` da resposta automática (validação inbound etapa 2)
