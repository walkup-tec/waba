# LOG — 2026-07-10 — restore-landing trava em «delegando reconcile atômico»

## Sintoma

`/root/restore-landing-routers-vps.sh` (v7 no VPS) após HUP imprime `delegando reconcile atômico` e **trava** (loop com reconcile/permanent-all).

Breve janela: `disparos:200 bet:200` → Ctrl+C → volta 404.

## Causa

Script no VPS diverge do repo (repo `restore-landing-routers` v8 **não** tem essa frase). Provável recursão: restore → reconcile → restore/permanent-all.

## Bypass (sem reconcile)

Usar só `fix-landings-both-vps.sh` (patch main.yaml + HUP) **ou** bloco inline abaixo. **Não** rodar restore/reconcile enquanto travar.

```bash
# 1) Baixar fix limpo
curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/fix-landings-both-vps.sh" -o /tmp/fix-landings-both.sh
sed -i 's/\r$//' /tmp/fix-landings-both.sh
timeout 90 bash /tmp/fix-landings-both.sh || true

# 2) Validar
curl -sS -o /dev/null -w "disparos:%{http_code} bet:%{http_code} waba:%{http_code}\n" --max-time 15 \
  --resolve wabadisparos.com.br:443:127.0.0.1 https://wabadisparos.com.br/ \
  --resolve bet.waba.info:443:127.0.0.1 https://bet.waba.info/ \
  --resolve waba.draxsistemas.com.br:443:127.0.0.1 https://waba.draxsistemas.com.br/health
```

Se sync timer no VPS chama restore e trava de novo: desabilitar timers problemáticos (já no fix-landings-both).

## Palavras-chave

`delegando reconcile atômico`, `hang`, `fix-landings-both`, `loop restore`
