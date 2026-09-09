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
- Disparo Cloud é menu da seção Laboratório, acima de Automação. Templates ficou só lista/criar. Planilha com telefones em qualquer formato comum no Brasil, sem prévia por número. Envio só de template aprovado, pelo número Ativo e disponível **do mesmo card do portfólio**. Depois de iniciar, a tabela mostra data, campanha, cliente, envios, barra de andamento e status. O campo de template tem filtro de categoria (primeira opção todas) e o rótulo é `nome-categoria`. A campanha do assinante só lista **Em andamento**, no formato `nome - campanha - envios`. Colunas de telefone/nome só depois do template; se houver variável, é nome ou número. Ao usar o número ele fica ocupado até a campanha finalizar e o relatório ser gerado. O relatório dessa campanha coleta o webhook da Meta (não fecha só com Graph 200) e inclui cliques. Campanhas de operadores sem Laboratório permanecem com relatório manual.
- Wizard da campanha: etapa **Mídia** com Imagem (PNG/JPG, 1080×1080) ou Vídeo (somente MP4, H.264, AAC ou sem áudio, até 16 MB). As regras aparecem antes do arquivo. Na API Oficial, a planilha entra sem telefones duplicados (1 envio por número).
- Assistente de templates: após Gerar, cada uma das 3 opções tem **Editar** / **Salvar**. O Enviar para META usa o texto salvo.

Relatório Lab: coleta entregues/lidos pelo webhook da Meta; o JSON **não fecha** só com aceite Graph. Marker no GitHub `master`: `DEPLOY-2026-09-09-204800-lab-report-wait-meta-statuses` (`d6aed15`). EasyPanel só aplica depois do Redeploy autorizado. Campanha nova, após esse marker no `/health`, permanece em coleta até delivered/read/failed.

Overrides só de leitura (não são coleta ao vivo): Campanha Jandira 1.990 / 1.156 / 2 → 981 entregues, 431 lidos, sem cliques; Opt in PTX 2996 / 1980 / 0 → 1724 / 986 / 232.

Disparo Cloud: resume no boot se o processo cair; não Redeployar com `blockRedeploy=true`. Cabeçalho de mídia só `{ id }` local (sem weblink lookaside). Fracionamento ≤500 por número, um relatório só. Número ocupado até o relatório fechar.

Campanha Jandira 2: lotes 131053 cancelados. Disparo 15:51 (Cleison) travou no Redeploy; resume órfão já está no código. Eventos Meta daquele dia não voltam.

Em andamento: aprovação dos templates na Meta (até 24 h). Redeploy do marker `204800` quando o usuário autorizar. Validar coleta num disparo novo depois disso.
