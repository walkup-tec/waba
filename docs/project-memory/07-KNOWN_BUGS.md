# Bugs conhecidos

Templates já sincronizados **antes** da correção do weblink 131053 podem não ter o arquivo de cabeçalho aliasado no id local. Nesse caso o próximo Disparo Cloud aborta com o aviso de 403 até **Atualizar da Meta** (se o handle `4::` original ainda existir no disco) ou reenviar a mídia do cabeçalho num template novo.

O Disparo Cloud da Jandira 2 (`26d33b09-…`) é cancelado no boot (void). O número fica livre e a campanha do assinante volta a aparecer no Disparo Cloud para refazer. O assinante continua em **Em andamento** até existir um disparo novo com entrega.

Redeploy EasyPanel do disparador pode deixar login em 502 até o heal republicar `:30180`. Isso não é senha inválida.
