# LOG — mitigação Traefik down vs cache browser

## Pergunta
Cache forçado no cliente para manter landings visíveis se Traefik cair? Outras proteções?

## Resposta técnica
- Sem Traefik em :443 → TCP/TLS falha. `Cache-Control` no HTML **não** serve a página: o browser nem completa o request.
- Service Worker ajuda só quem já visitou e registrou SW; 1ª visita e DNS direto ao VPS sem SW = erro.
- Melhor “site no ar com origem morta”: Cloudflare proxy + Always Online / cache edge ([doc](https://developers.cloudflare.com/cache/how-to/always-online/)).
- Melhor prevenção real: achar por que Traefik vai 0/1 + bootstrap mais agressivo (já existe timer ~2 min).

## Prioridade sugerida
1. Cloudflare Always Online (se DNS laranja) + Cache Rules HTML curto / assets longos
2. Acelerar/garantir bootstrap Traefik + alerta WhatsApp se :443=000
3. (Opcional) SW nas landings — cobertura parcial
4. Não: max-age longo no HTML como “failover”
