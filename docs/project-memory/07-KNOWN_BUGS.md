# Bugs conhecidos

Campanhas já fechadas sem webhook da Meta (Jandira 2 de 03/09/2026, Opt in PTX com fingerprint 2996/1980/0) **não recuperam** delivered/read reais: a Meta não reenvia `statuses` antigos. A tela pode mostrar override pontual de leitura. Disparo novo, com o marker `204800` no ar, coleta ao vivo.

Sem arquivo local no servidor, o Disparo Cloud de template com mídia no topo **não inicia**: o operacional envia de novo a mesma foto na tela. A Meta não reusa o link de exemplo.

Redeploy EasyPanel do disparador pode deixar login em 502 até o heal republicar `:30180`. Isso não é senha inválida.

Com Disparo Cloud ativo (`cloudBroadcastProtect.blockRedeploy=true`), Redeploy interrompe o lote em memória (o resume no boot retoma, mas atrasa).
