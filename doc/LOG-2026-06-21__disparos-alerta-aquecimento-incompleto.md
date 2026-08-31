# Alerta aquecimento incompleto — Seleção de números

**Data:** 2026-06-21  
**Marker:** `DEPLOY-2026-06-21-disparos-alerta-aquecimento-incompleto`

## Pedido

Ao salvar a etapa **Seleção de números**, se houver instâncias com aquecimento incompleto (menos de 3 fogos), exibir confirmação antes de continuar.

## Solução

- Modal compacto com texto: *"Você selecionou números que não estão completamente aquecidos. Tem certeza que deseja continuar?"*
- **Continuar** (botão vermelho) — prossegue com o save da etapa.
- **Reconfigurar** (link discreto) — fecha modal, reabre a seção e foca o picker.
- Critério: `warmthLevel < 3` via `getInstanceUsage()`.
- Ignorado na aba **Comprar números** (API Alternativa), onde o picker não usa aquecimento EVO.

## Arquivos

- `index.html`
- `src/deploy-marker.ts`

## Validar

1. Selecionar instância com 0–2 fogos → Salvar configurações → modal aparece.
2. Reconfigurar → volta à seção sem salvar.
3. Continuar → salva normalmente.
4. Só instâncias com 3 fogos → sem modal.
