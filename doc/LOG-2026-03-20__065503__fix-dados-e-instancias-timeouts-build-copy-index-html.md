# LOG - Fix de /dados e timeouts + build copia index.html

## Contexto
Você pediu para retomar o trabalho do `DisparadorN8n`. No fluxo atual:
- O backend expõe `GET /dados` (Supabase) e `GET /instancias` (Evolution API).
- Sem configuração de Supabase (ou quando a chamada falha), `GET /dados` pode ficar lento/travar.
- O build (`npm run build`) compila TS para `dist/`, mas não copiava automaticamente o `index.html` da raiz para `dist/`, o que pode causar inconsistência ao publicar.

## Comandos executados / ações
- `npm install`
- `npm run build`
- Validação via HTTP em `http://localhost:3000/`:
  - `GET /instancias`
  - `GET /dados`

## Solução implementada (passo a passo)
1. `src/index.ts`: Supabase sob demanda
   - Removi a criação “imediata” do client Supabase no topo do arquivo.
   - Implementei `getSupabaseClient()` para criar o client apenas quando `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` estiverem disponíveis.
   - Em `GET /dados`, se o Supabase não estiver configurado, a rota agora responde rapidamente com `503` (ao invés de executar chamadas que podem travar).

2. `src/index.ts`: validação do filtro de datas
   - Validei `rangeStart` e `rangeEnd` no formato `YYYY-MM-DD` (regex) e retornei `400` caso estejam fora do padrão.

3. `src/index.ts`: timeout para Evolution API
   - Em `GET /instancias`, adicionei `AbortController` com timeout de `8000ms` para evitar que a chamada ao provider cause hang no backend.

4. `package.json` + `scripts/copy-index-html.mjs`: coerência do build
   - Atualizei o script `build` para executar `tsc` e depois copiar a raiz `index.html` para `dist/index.html`.
   - Adicionei `scripts/copy-index-html.mjs` para cópia cross-platform sem dependências extras.

## Arquivos criados/alterados
- Alterado: `src/index.ts`
- Alterado: `package.json`
- Criado: `scripts/copy-index-html.mjs`
- Atualizados por build/cópia: `dist/index.js`, `dist/index.html`

## Como validar
- Confirmar que o servidor inicia:
  - `npm run dev`
  - Verificar no log que está rodando em `http://localhost:3000`
- Validar endpoints:
  - `curl http://localhost:3000/instancias` deve retornar `200` com `{ total, ativas, desconectadas }`
  - `curl http://localhost:3000/dados` deve retornar `200` quando Supabase estiver configurado; caso contrário deve retornar `503`

## Observações de segurança
- Não loguei `SUPABASE_SERVICE_ROLE_KEY` nem body/headers sensíveis.
- A rota `GET /dados` retorna uma mensagem segura quando Supabase não está configurado.
- Mantive `EVO_API_KEY` como fallback no código (por compatibilidade do ambiente local). Idealmente isso deve ser removido e exigido via variável de ambiente em uma próxima rodada.

## Itens para evitar duplicação no futuro (keywords)
- `supabase` `503` `GET /dados`
- `rangeStart` `rangeEnd` `YYYY-MM-DD`
- `AbortController` `timeout` `GET /instancias`
- `build` `copy index.html` `dist/index.html`

