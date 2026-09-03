# Bugs conhecidos

Templates já sincronizados **antes** da correção do weblink 131053 podem não ter o arquivo de cabeçalho aliasado no id local. O Disparo Cloud da Jandira 2 foi refeito em `c8e99348-…` (03/09/2026 17:32 UTC) e voltou a falhar 131053 em todos os aceites Graph; 0 entregues. Esse lote deve ser cancelado. Sem arquivo local válido, **Atualizar da Meta** (handle `4::` no disco) ou reenviar a mídia do cabeçalho.

O Disparo Cloud antigo da Jandira 2 (`26d33b09-…`) e o retrabalho `c8e99348-…` são cancelados no boot (void) se ainda estiverem ativos. O assinante continua em **Em andamento** até existir um disparo novo com entrega.

Redeploy EasyPanel do disparador pode deixar login em 502 até o heal republicar `:30180`. Isso não é senha inválida.
