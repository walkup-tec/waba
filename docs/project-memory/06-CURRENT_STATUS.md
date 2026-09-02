# Estado atual

Concluído no laboratório Meta:

- tabela unificada de templates de todos os portfólios;
- filtro Todos os Portfólios, busca por nome, tags de status;
- na tabela: Visualizar abre preview WhatsApp com a imagem de cabeçalho quando houver mídia; Excluir abre modal de confirmação com spinner até a Graph concluir;
- o painel legado Visualizar / usar em teste saiu;
- Atualizar da Meta também remove da tabela o que já não existe na biblioteca da Meta;
- Enviar para META: confirmação → processando (spinner e etapas) → resultado no mesmo overlay. O clique em Enviar não pode fechar o modal no meio do processamento. Cabeçalho de imagem: PNG/JPEG sem teto de tamanho no Waba; recusa da Graph vai para o alerta.
- criação Graph inclui o botão silencioso **Bloquear** (`QUICK_REPLY`); o preview e a tabela não o exibem.
- adicionar número a um portfólio existente não cria card vazio «Portfólio empresarial».
- **Editar perfil** no card do número envia a foto (JPEG/PNG até 5 MB) à Meta; o cliente passa a vê-la no WhatsApp. O botão e o clique na foto só existem no número **Ativo**.
- operacional/suporte vê a seção Laboratório quando os menus estão marcados no cadastro (não só a conta Mozart).
- Com esse privilégio, o operacional vê os portfólios, números e templates já conectados no Laboratório (mesmo workspace do dono).
- Disparo Cloud é menu da seção Laboratório, acima de Automação. Templates ficou só lista/criar. Planilha com telefones em qualquer formato comum no Brasil, sem prévia por número. Envio só de template aprovado, pelo número Ativo e disponível **do mesmo card do portfólio**. Depois de iniciar, a tabela mostra data, campanha, cliente, envios, barra de andamento e status. O campo de template tem filtro de categoria (primeira opção todas) e o rótulo é `nome-categoria`. A campanha do assinante só lista **Em andamento**, no formato `nome - campanha - envios`. Colunas de telefone/nome só depois do template; se houver variável, é nome ou número. Ao usar o número ele fica ocupado até a campanha finalizar e o relatório ser gerado. O relatório dessa campanha fecha com dados da Meta e cliques. Campanhas de operadores sem Laboratório permanecem com relatório manual.

Em andamento: aprovação dos templates na Meta (até 24 h). Relatório da Campanha Jandira deste disparo (1.990 / 1.156 / 2) mostra 981 entregues e 431 lidos, sem cliques, via override de leitura.

Marker: `DEPLOY-2026-09-02-201800-jandira-981-431`.

GitHub `walkup-tec/waba` `master` recebe este tip. Redeploy EasyPanel do `waba_disparador` fica com o usuário.
