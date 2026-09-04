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
- Wizard da campanha: etapa **Mídia** com Imagem (PNG/JPG, 1080×1080) ou Vídeo (somente MP4, H.264, AAC ou sem áudio, até 16 MB). As regras aparecem antes do arquivo. Na API Oficial, a planilha entra sem telefones duplicados (1 envio por número).
- Assistente de templates: após Gerar, cada uma das 3 opções tem **Editar** / **Salvar**. O Enviar para META usa o texto salvo.

Em andamento: aprovação dos templates na Meta (até 24 h). Relatório da Campanha Jandira deste disparo (1.990 / 1.156 / 2) mostra 981 entregues e 431 lidos, sem cliques, via override de leitura. Relatório operacional Lab passa a listar falhas da Meta e envios sem comprovante de entrega. Relatório do assinante passa a listar a linha do tempo (criação, atendimento, aprovação do template, início e fim do disparo) numa trilha de pontos (horizontal no desktop, vertical no celular) e o aviso de até 3 horas da Meta.

Campanha Jandira 2: lotes 131053 cancelados. O Disparo Cloud de template com mídia no topo só sobe bytes locais e manda `{ id }`. Se o arquivo não estiver no servidor (template aprovado da biblioteca, ou a mesma foto em outro modelo), o operacional envia a foto de novo na tela do disparo. A Meta não reusa o link de exemplo.

Disparo Jandira 2 `5552c6f7-…` (15:51): 357 enviados Graph, **289 delivered/read**, 805 na fila, sem 131053. Travou no Redeploy. Marker `DEPLOY-2026-09-03-193200-broadcast-resume-orphan` retoma no boot — **Redeploy** do `waba_disparador` (não voidar este id).

Marker: `DEPLOY-2026-09-04-102500-quantum-bm-waba-fanout` (portfólio lista todas as WABAs do BM — Quantum 3 números).

GitHub `walkup-tec/waba` `master` recebe o tip. Redeploy EasyPanel do `waba_disparador` fica com o usuário.
