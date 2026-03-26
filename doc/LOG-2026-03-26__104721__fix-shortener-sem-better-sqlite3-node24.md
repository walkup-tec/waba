## Contexto do pedido

Tornar o projeto do encurtador (`D:\Waba\shortener-waba`) instalavel e executavel no Windows atual sem erro de dependencia nativa.

## Comandos solicitados / acoes executadas

1. Leitura e analise:
   - leitura de `shortener-waba/server.js`
   - leitura de `shortener-waba/package.json`
2. Atualizacao de dependencia:
   - remocao de `better-sqlite3` do `package.json`
3. Validacao de ambiente:
   - `npm install` em `shortener-waba`
4. Smoke test local:
   - start temporario com `SHORTENER_API_KEY` local
   - `GET /health`
   - `GET /ready`
5. Qualidade:
   - leitura de lints dos arquivos alterados

## Solucao implementada (passo a passo)

1. Substitui a persistencia SQLite (`better-sqlite3`) por persistencia em arquivo JSON (`DATA_PATH`, padrao `/data/shortener.json`).
2. Mantive os mesmos endpoints e contrato principal:
   - `POST /api/shortlinks`
   - `GET /s/:slug`
   - `GET /health`, `GET /ready`, `GET /status`
3. Implementei:
   - carregamento inicial do arquivo com indice em memoria por `slug`
   - escrita atomica (`.tmp` + rename) para reduzir risco de corrupcao
   - readiness baseado na disponibilidade do arquivo de dados
4. Ajustei o log de startup para exibir `data=<path>` no lugar de `db=<path>`.

## Arquivos criados/alterados

- `shortener-waba/server.js` (update)
- `shortener-waba/package.json` (update)

## Como validar

1. Em `D:\Waba\shortener-waba`, rodar:
   - `npm install`
2. Definir chave e iniciar:
   - PowerShell: `$env:SHORTENER_API_KEY='sua-chave'; npm start`
3. Testar:
   - `GET http://localhost:3000/health`
   - `GET http://localhost:3000/ready`
4. Criar link curto:
   - `POST /api/shortlinks` com `x-api-key` e payload `{ "longUrl": "...", "tenantId": "..." }`

## Observacoes de seguranca

- Segredo continua exigido via `x-api-key` (`SHORTENER_API_KEY`), sem exposicao em logs.
- Nenhuma credencial foi adicionada ao repositorio.
- Persistencia local em arquivo segue isolamento logico por `tenantId` no registro.

## Itens para evitar duplicacao no futuro (palavras-chave)

- shortener-json-store
- remove-better-sqlite3
- node24-windows-fix
- shortener-ready-health
