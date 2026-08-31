# LOG — Aquecedor persiste após refresh/navegação

**Data:** 2026-06-19  
**Pedido:** Motor não pode parar ao sair da tela ou dar F5; deve aparecer em funcionamento como antes.

## Causas

1. `setAquecedorEditMode(true)` no boot da página **escondia** o painel do motor mesmo com servidor ativo.
2. UI não retomava motor quando `runtime-intent.json` pedia `desired=true` após redeploy.
3. Erros EVO/rede caíam no `catch` genérico ("Erro inesperado").

## Correção

- `GET /aquecedor/status` expõe `desiredRunning` + `ownerEmailBound`.
- `syncAquecedorRuntimeUi()`: auto `POST /aquecedor/start` se desejado e parado; mostra painel se ativo.
- Boot: só entra em modo edição se motor não estava ligado.
- Ciclo: erros EVO e exceções com mensagem explícita (motor continua no intervalo).

## Marker

`DEPLOY-2026-06-19-aquecedor-persiste-apos-refresh`

## Validar

1. Iniciar aquecedor → F5 → deve mostrar **Motor: ativo** e botão **Pausar**.
2. Sair da aba e voltar → mesmo estado.
3. Redeploy com volume `data/` → motor retoma sozinho.
