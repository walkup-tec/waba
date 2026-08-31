# LOG — Tag Proteção ativa + ativar campanha no 1º clique

## Contexto

Melhorar o card da campanha Alternativa: mostrar **Proteção ativa** só com Proxy confirmada; o botão Ativar precisava de vários cliques.

## Causa do clique repetido

O `POST /disparos/campanhas/:id/estado` esperava `prepareProxyBrasil` (dezenas de segundos por instância). O front reabilitava «Ativar» antes do reload; o 2º clique pausava a campanha.

## Solução

1. Ativar/pausar grava o status na hora; prepare da Proxy vai para background (com resolução de alias 6973→8973).
2. Tag só se `/proxy/find` ou `proxy/set` recente confirmar `enabled` em **todas** as instâncias selecionadas.
3. Front: trava in-flight, texto «Ativando…», cache local do status, timeout 20s.

## Arquivos

- `src/proxy/evo-instance-proxy.service.ts`
- `src/index.ts`
- `index.html`
- `src/deploy-marker.ts`

## Validar

- `/health` → `DEPLOY-2026-08-11-protecao-ativa-ativar-1-clique`
- Um clique em Ativar → botão vira Pausar
- Tag só com Proxy ligada de fato nas instâncias da campanha

## Keywords

protecao-ativa, proxy-find, ativar-campanha, 1-clique
