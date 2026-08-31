# LOG — Aquecedor: liberar PROCESSANDO órfão global

**Data:** 2026-07-24  
**Marker:** `DEPLOY-2026-07-24-aquecedor-release-stuck-global`

## Sintoma (UI)

- Detalhe EVO: `6635 → 8918` — mensagem só na origem (falha real de entrega no destino)
- Fila: `1 PROCESSANDO | id 2762 (6973) há 1609 min`
- Motor em pausa da janela humanizada até ~11:06

## Causas

1. **Falha real 8918:** EVO HTTP 201, WhatsApp do destino não recebeu — cooldown do par OK; não é falso sucesso.
2. **Órfão PROCESSANDO:** `releaseStuckAquecedorQueueRows` só resetava linhas cuja `instancia` estava no escopo conectado. `6973` saiu do ciclo → nunca liberava (>27h na UI).

## Correção

- Liberação de PROCESSANDO travado (>3 min) **sem filtro de escopo**
- `GET /aquecedor/fila-localizar` chama o release antes de listar (limpa órfãos ao abrir Diagnóstico)

## Validar

1. Redeploy; marker `DEPLOY-2026-07-24-aquecedor-release-stuck-global`
2. Diagnóstico / fila: não deve mais mostrar 6973 PROCESSANDO 1600+ min
3. Após janela abrir: próximo par ≠ 6635→8918 se ainda em cooldown
4. Checar conexão/restrição do **8918** no aparelho (destino sem receber)

## Keywords

aquecedor, PROCESSANDO, órfão, 6973, 6635, 8918, releaseStuck, stuck queue
