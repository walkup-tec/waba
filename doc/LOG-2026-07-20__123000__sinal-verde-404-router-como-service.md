# LOG — Sinal Verde 404 após restore v3

**Data:** 2026-07-20 ~12:30

## Sintoma

Após publish `:30310` + restore: HTTPS `acesso-sinalverde.com` → **404**.  
Validação v3 marcou “CRM OK” só porque não tinha title Easypanel (falso positivo).

## Causa

`host_fixes` escolheu `http-sinal-verde_acesso-sinalverde-0` (chave de **router**) como service Traefik.  
Routers `http-…-1` / `https-…-1` passaram a apontar para essa chave → 404.

## Correção

Restore **v4**: só escolhe chave com `loadBalancer` e **sem** prefixo `http-`/`https-`.

## Keywords

sinal-verde, 404, router vs service, host_fixes, loadBalancer
