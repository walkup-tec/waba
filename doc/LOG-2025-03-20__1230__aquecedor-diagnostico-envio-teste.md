# Log: Aquecedor – Diagnóstico, envio teste e ordem de combinações

## Contexto
Implementação de melhorias no aquecedor: endpoint de diagnóstico, bypass de janela/cooldown no envio teste, confirmação da ordem de combinações origem→destino, e criação de mensagem de teste.

## Comandos / Ações executadas
- Implementação de `GET /aquecedor/diagnostico`
- `POST /aquecedor/run-once` passa a ignorar janela humanizada e cooldown (para testes)
- Validação da ordem: origem fixa, destinos em sequência (sem autoenvio)
- Endpoint `POST /aquecedor/criar-mensagem-teste`
- Botões na UI: "Diagnóstico" e "Criar mensagem teste"

## Solução implementada

### 1. Ordem das combinações (já correta)
Para cada origem, iteramos todos os destinos exceto a própria origem:
- Inst1→2, Inst1→3, Inst1→4, Inst1→5, Inst1→6, Inst1→7
- Inst2→1, Inst2→3, Inst2→4, Inst2→5, Inst2→6, Inst2→7
- E assim sucessivamente

### 2. Envio teste (bypass)
`runAquecedorCycle(forceTest = false)` — quando `forceTest = true`:
- Ignora `nextAllowedAt` (cooldown)
- Ignora verificação da janela humanizada

`POST /aquecedor/run-once` chama `runAquecedorCycle(true)`.

### 3. Diagnóstico `GET /aquecedor/diagnostico`
Retorna:
- `runtime`: status atual (running, isProcessing, nextAllowedAt, lastResult)
- `evo`: ok, connectedCount, instances[], mensagem (em caso de erro)
- `supabase`: ok, pendingCount
- `janela`: aberta, motivo
- `proximaCombinacao`: { origem, destino }
- `cicloGlobal`: índice do ciclo

### 4. Criar mensagem de teste `POST /aquecedor/criar-mensagem-teste`
- Body opcional: `{ mensagem?: string }`
- Insere na tabela `aquecedor` com `status: PENDENTE`, `scheduled_at: now()`

### 5. UI
- Botão "Diagnóstico": chama `GET /aquecedor/diagnostico` e exibe resumo no log de comandos
- Botão "Criar mensagem teste": chama `POST /aquecedor/criar-mensagem-teste`
- Após "Envio teste", o `lastResult` é adicionado ao log de comandos

## Arquivos alterados
- `src/index.ts`: runAquecedorCycle(forceTest), run-once, criar-mensagem-teste, diagnostico
- `index.html`: botões Diagnóstico e Criar mensagem teste, handlers, log de lastResult

## Como validar
1. `npm run build`
2. Iniciar servidor e acessar aba Aquecedor
3. Salvar config, clicar "Diagnóstico" — deve exibir instâncias EVO, fila e janela
4. Clicar "Criar mensagem teste" — deve criar mensagem PENDENTE
5. Clicar "Envio teste" — deve executar ciclo ignorando janela/cooldown

## Palavras-chave
aquecedor, diagnostico, envio-teste, run-once, criar-mensagem-teste, combinações origem destino, janela humanizada, cooldown
