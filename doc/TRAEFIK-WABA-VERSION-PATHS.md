# Traefik — V01/V02 em subpastas (sem DNS extra)

## URLs públicas

| Ambiente | URL |
|----------|-----|
| Produção | https://waba.draxsistemas.com.br/ |
| **V01** | https://waba.draxsistemas.com.br/version-01/ |
| **V02** | https://waba.draxsistemas.com.br/version-02/ |

Mesmo domínio, três backends (portas host no VPS).

## Serviços Easypanel (Swarm)

| Serviço | Branch | Porta host | `WABA_ENV` | `WABA_BASE_PATH` |
|---------|--------|------------|------------|------------------|
| `waba_disparador` | `master` | **30180** | (vazio) | (vazio) |
| `waba_disparador_v01` | `v01` | **30190** | `v01` | `/version-01` |
| `waba_disparador_v02` | `v02` | **30200** | `v02` | `/version-02` |

Republicar após redeploy:

```bash
docker service update --publish-add mode=host,published=30180,target=80,protocol=tcp waba_waba_disparador
docker service update --publish-add mode=host,published=30190,target=80,protocol=tcp waba_waba_disparador_v01
docker service update --publish-add mode=host,published=30200,target=80,protocol=tcp waba_waba_disparador_v02
```

## Trecho Traefik (`main.yaml`)

Ajustar o router do host `waba.draxsistemas.com.br`: rotas por **PathPrefix** com prioridade maior que a raiz.

```yaml
http:
  middlewares:
    waba-strip-v01:
      stripPrefix:
        prefixes:
          - /version-01
    waba-strip-v02:
      stripPrefix:
        prefixes:
          - /version-02

  routers:
    waba-v01:
      rule: Host(`waba.draxsistemas.com.br`) && PathPrefix(`/version-01`)
      entryPoints:
        - websecure
      service: waba-v01-svc
      middlewares:
        - waba-strip-v01
      tls: {}
      priority: 100

    waba-v02:
      rule: Host(`waba.draxsistemas.com.br`) && PathPrefix(`/version-02`)
      entryPoints:
        - websecure
      service: waba-v02-svc
      middlewares:
        - waba-strip-v02
      tls: {}
      priority: 100

    waba-prod:
      rule: Host(`waba.draxsistemas.com.br`)
      entryPoints:
        - websecure
      service: waba-prod-svc
      tls: {}
      priority: 10

  services:
    waba-prod-svc:
      loadBalancer:
        servers:
          - url: "http://172.17.0.1:30180/"
    waba-v01-svc:
      loadBalancer:
        servers:
          - url: "http://172.17.0.1:30190/"
    waba-v02-svc:
      loadBalancer:
        servers:
          - url: "http://172.17.0.1:30200/"
```

Recarregar Traefik:

```bash
docker kill -s HUP $(docker ps -q -f name=traefik -f status=running | head -1)
```

## Validar

```bash
curl -sS https://waba.draxsistemas.com.br/health
curl -sS https://waba.draxsistemas.com.br/version-01/health
curl -sS https://waba.draxsistemas.com.br/version-02/health
```

Esperado: `basePath` = `/`, `/version-01`, `/version-02` e `wabaEnv` coerente.
