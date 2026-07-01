# LOG — Validação CONFIRMAR modal fases progressivas

**Data:** 2026-07-01  
**Marker:** `DEPLOY-2026-07-01-validacao-confirmar-modal-fases-progressivas`

## Contexto

O passo 3 do wizard «Conectar instância WhatsApp» exibia ao mesmo tempo: instruções, spinner, pergunta Sim/Não e as duas linhas de checklist (Recepção + Resposta automática). O scroll automático escondia o card de instruções. Ao clicar **Sim, já enviei**, a UI ficava travada com duplo «Processando».

## Solução

### UI progressiva por fases (`data-phase` em `#register-inbound-progress`)

| Fase | O que o usuário vê |
|------|-------------------|
| `instructions` | Card CONFIRMAR + spinner de aguardo |
| `prompt` | Card + pergunta Sim/Não (sem spinner duplicado) |
| `verify-receive` | Só checklist «Recepção» em processamento |
| `verify-send` | Recepção OK + «Resposta automática» |
| `complete` | Ambos concluídos |

### Correções de fluxo

- `applyRegisterInboundStatus` não exibe mais a linha de envio antes da recepção confirmada.
- `handleRegisterInboundUserConfirmSent` entra em `verify-receive`, chama `confirmar-envio` e, se não encontrar CONFIRMAR, volta ao `prompt` (sem travar em Processando).
- Removidos `scrollRegisterWizardToProgress` e `syncRegisterValidationPaneLayout` (scroll que escondia instruções).
- Instruções só são compactadas em `verify-send` / `complete` (`reg-pane-validating`).

## Arquivos alterados

- `index.html` — CSS + JS do wizard passo 3
- `src/deploy-marker.ts`
- `scripts/verify-validacao-modal-phases.cjs` — verificação estática dos símbolos

## Validação

```powershell
npm run build
node scripts/verify-validacao-modal-phases.cjs
```

Teste manual no modal: passo 3 → aguardar 20s → Sim → deve mostrar só «Recepção»; ao detectar CONFIRMAR, avançar para «Resposta automática».

## Palavras-chave

`validacao-inbound`, `CONFIRMAR`, `modal`, `fases-progressivas`, `confirmar-envio`, `register-inbound-progress`, `data-phase`
