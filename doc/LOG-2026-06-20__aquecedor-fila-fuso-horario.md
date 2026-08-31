# LOG — Aquecedor fila: fuso horário

**Data:** 2026-06-20  
**Marker:** `DEPLOY-2026-06-20-aquecedor-fila-fuso-horario`

## Problema
Fila do aquecedor exibia horário errado (ex.: `11:28:52` em vez do horário de Brasília).

## Causa
`formatDateBr` anexava `Z` em timestamps sem offset → interpretava horário SP como UTC e subtraía 3h na exibição.

## Correção
- `parseWabaInstant()` — naive → `-03:00` (America/Sao_Paulo); com offset/Z mantém instante UTC
- `formatDateBr()` usa o parser acima
- Ordenação `/aquecedor/envios` usa `parseWabaInstant`
- Envios concluídos: `logs_envios_br.data_envio_br` (view já em SP)

## Arquivos
- `src/index.ts`
- `src/deploy-marker.ts`

## Validação
- Reiniciar V02; conferir item "Em Fila" com horário local correto
