# LOG: Traefik permanente WABA — script dedicado (separado do Typebot)

## Contexto

- `https://waba.draxsistemas.com.br/` retornando **502 Bad Gateway**.
- No Typebot a correção usa `traefik-permanent-vps.sh` (repo typeBot).
- Decisão: **não compartilhar** scripts entre projetos; WABA com script próprio.
- Easypanel: projeto **waba**, serviço **waba_disparador**.

## Solução

1. **`scripts/traefik-permanent-waba-vps.sh`**
   - Instala em `/root/traefik-permanent-waba-vps.sh`
   - Patch `main.yaml` só para `waba_waba_disparador` / `waba.draxsistemas.com.br`
   - Rede overlay `easypanel-waba`
   - Watcher systemd + timer 20s + cron backup
   - Log: `/var/log/traefik-permanent-waba-fix.log`

2. **`scripts/diagnose-waba-502-vps.sh`** — diagnóstico pontual no VPS.

3. **`doc/FIX-TRAEFIK-WABA.md`** — guia operacional.

4. **`doc/deploy-docker.md`** — referência ao fix Traefik WABA.

## Arquivos criados/alterados

- `scripts/traefik-permanent-waba-vps.sh` (novo)
- `scripts/diagnose-waba-502-vps.sh` (novo)
- `doc/FIX-TRAEFIK-WABA.md` (novo)
- `doc/deploy-docker.md` (atualizado)
- `doc/memoria.md` (atualizado)

## Como validar no VPS

```bash
cp scripts/traefik-permanent-waba-vps.sh /root/
chmod +x /root/traefik-permanent-waba-vps.sh
/root/traefik-permanent-waba-vps.sh install
curl -sI --resolve waba.draxsistemas.com.br:443:127.0.0.1 https://waba.draxsistemas.com.br/health
# Esperado: HTTP/2 200
```

## Pendências

- Rodar `install` no VPS (usuário).
- Confirmar nome exato do host Easypanel (`WABA_EASYPANEL_HOST`) se usar subdomínio `*.easypanel.host`.

## Palavras-chave

`traefik-permanent-waba`, `waba_disparador`, `easypanel-waba`, `502`, `script-separado`
