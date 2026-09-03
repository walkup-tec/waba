# Bugs conhecidos

O Disparo Cloud da Jandira 2 (`26d33b09-…` e retrabalho `c8e99348-…`) foi cancelado (void). Sem arquivo local no servidor, o disparo de template com mídia no topo **não inicia**: o operacional envia de novo a mesma foto na tela do Disparo Cloud. A Meta não reusa o link de exemplo, mesmo se a imagem for igual em outro template aprovado.

O Disparo Cloud antigo da Jandira 2 (`26d33b09-…`) e o retrabalho `c8e99348-…` são cancelados no boot (void) se ainda estiverem ativos. O assinante continua em **Em andamento** até existir um disparo novo com entrega.

Redeploy EasyPanel do disparador pode deixar login em 502 até o heal republicar `:30180`. Isso não é senha inválida.

Redeploy (ou `docker restart`) no meio de um Disparo Cloud deixa o broadcast em `status: running` sem loop de envio — a UI fica «Enviando» no último contador e o número Cloud permanece ocupado até void manual no JSON.
