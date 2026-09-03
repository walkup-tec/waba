# Bugs conhecidos

Templates já sincronizados **antes** da correção do weblink 131053 podem não ter o arquivo de cabeçalho aliasado no id local. Nesse caso o próximo Disparo Cloud aborta com o aviso de 403 até **Atualizar da Meta** (se o handle `4::` original ainda existir no disco) ou reenviar a mídia do cabeçalho num template novo.

A Campanha Jandira 2 (intake `368d053b-…`, 03/09/2026) permanece **Em andamento** para o assinante: sem relatório, sem indicadores do disparo que falhou. O fechamento automático da Meta não conclui esta campanha. Operacional Lab continua vendo as falhas 131053.

Redeploy EasyPanel do disparador pode deixar login em 502 até o heal republicar `:30180`. Isso não é senha inválida.
