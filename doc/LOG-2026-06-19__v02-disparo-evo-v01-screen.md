# LOG — V02 tela Disparo EVO (espelho V01)

**Data:** 2026-06-19  
**Pedido:** Trazer tela de disparo do V01 para V02; menu **Disparo** + acesso via aba superior **API Alternativa**.

## Implementação

### UI (`index.html`)
- Menu lateral **Disparo** (`disparo-evo`, ícone foguete) na seção Disparos (production)
- Aba **API Alternativa** → `setActiveTab('disparo-evo')`
- Aba **API Oficial** → fluxo comercial (Créditos/Campanhas)
- Classe `waba-disparo-evo-mode`: mesma UI EVO do baseline (instâncias, config, campanhas Excel)
- `isDisparoEvoUi()` unifica baseline + V02 disparo-evo

### Backend
- `src/index.ts`: V02 usa `WABA_EVO_DISPARADOR` como V01
- `waba-menu-registry.ts`: entrada `disparo-evo`
- `.env.v02.example`: `WABA_EVO_DISPARADOR=true`

## Validar
1. `npm run dev:v02` + Ctrl+F5
2. Menu Disparo → picker instâncias + seções 1–7 + campanhas
3. Clicar API Alternativa no topo → mesma tela
4. API Oficial → Créditos (compra)

## Pendência
- Adicionar `WABA_EVO_DISPARADOR=true` no `.env.v02` local se tick EVO não subir
