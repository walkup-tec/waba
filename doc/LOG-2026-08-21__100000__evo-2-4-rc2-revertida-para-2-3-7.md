# Evolution: upgrade 2.4.0-rc2 (semana 11/08) revertida para 2.3.7

## Contexto

Usuário: na semana de 11/08 a Evolution foi atualizada para o botão nativo. Verificar.

## Evidências

| Quando | Imagem / API | Fonte |
|---|---|---|
| 03/08 | 2.3.7; sendButtons = viewOnce fantasma | Conversa SOMA; recomendação de subir 2.4.0-rc |
| 06/08 | WABA passa a chamar `sendButtons` (`4a72c1d`) | Git |
| 11/08 | Campanha Alternativa com botão visível no celular | Relato operacional + prints da época |
| 20/08 ~11:07 | `evoapicloud/evolution-api:2.4.0-rc2`, Baileys `7.0.0-rc.9` | SSH `docker inspect` em `walkup_evo-walkup-api` |
| 20/08 ~11:16 | Após `service update` HISTORIC=false / Redeploy Easypanel: tag vira `latest` → API **2.3.7** | Mesma sessão SSH |
| 21/08 07:27 | `evoapicloud/evolution-api:latest`, API `2.3.7` | LOG H4 |
| 21/08 agora | `"version":"2.3.7"` no GET público `/` | https://walkup-evo-walkup-api.achpyp.easypanel.host/ |

A 2.4.0-rc remove o wrapper `viewOnceMessage` e injeta `native_flow` — é o fix do botão ([release 2.4.0-rc](https://github.com/evolution-foundation/evolution-api/releases)). A 2.3.7 volta a envolver CTA em viewOnce.

## Conclusão

O upgrade **existiu** e estava no ar até a manhã de 20/08 (`2.4.0-rc2`). Não está mais: o Redeploy/update daquele dia deixou `:latest` = **2.3.7**. Por isso o botão da semana de 11/08 sumiu, sem o WABA ter “desligado” o payload.

## Como validar o retorno

No Easypanel, pin **`evoapicloud/evolution-api:2.4.0-rc2`** (não `latest`). GET `/` deve reportar 2.4.x, não 2.3.7. Depois um envio Alternativa no celular.

## Palavras-chave

Evolution 2.4.0-rc2, 2.3.7, latest, EasyPanel Redeploy, sendButtons, viewOnceMessage, walkup_evo-walkup-api
