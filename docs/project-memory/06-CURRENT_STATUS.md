# Estado atual

Concluído no laboratório Meta:

- tabela unificada de templates de todos os portfólios;
- filtro Todos os Portfólios, busca por nome, tags de status;
- na tabela: Visualizar abre preview WhatsApp com a imagem de cabeçalho quando houver mídia; Excluir abre modal de confirmação com spinner até a Graph concluir;
- o painel legado Visualizar / usar em teste saiu;
- Atualizar da Meta também remove da tabela o que já não existe na biblioteca da Meta;
- Enviar para META: confirmação → processando (spinner e etapas) → resultado no mesmo overlay. O clique em Enviar não pode fechar o modal no meio do processamento. Cabeçalho de imagem: PNG/JPEG até 5 MB (assinatura do arquivo + nome simples na Graph).
- criação Graph inclui o botão silencioso **Bloquear** (`QUICK_REPLY`); o preview e a tabela não o exibem.
- adicionar número a um portfólio existente não cria card vazio «Portfólio empresarial».
- **Editar perfil** no card do número envia a foto (JPEG/PNG até 5 MB) à Meta; o cliente passa a vê-la no WhatsApp. Número precisa estar Ativo.

Em andamento: aprovação dos templates na Meta (até 24 h).

Marker: `DEPLOY-2026-09-02-120000-foto-perfil-whatsapp`.

GitHub `walkup-tec/waba` `master` recebe este tip. Redeploy EasyPanel do `waba_disparador` fica com o usuário.
