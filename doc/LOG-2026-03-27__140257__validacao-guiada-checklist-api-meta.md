# Contexto do pedido

Usuário aprovou a ideia de validação guiada e solicitou implementação.

# Comandos e ações executadas

1. Alteração em `index.html` para incluir checklist visual de validação guiada.
2. Implementação de estado de progresso no frontend com persistência em `localStorage`.
3. Integração automática dos passos com ações já existentes das fases 1, 2 e 3.
4. Build:
   - `npm run build`
5. Validação:
   - `ReadLints` em `index.html` sem erros.

# Solução implementada (passo a passo)

1. Criado bloco `Validação guiada (checklist)` na aba `1) Ativos API`.
2. Passos monitorados:
   - Credenciais preenchidas (Token + WABA ID)
   - Números do WABA carregados
   - Número registrado na Cloud API
   - App inscrito no `subscribed_apps`
   - Template utilidade criado
   - Disparo de teste executado
3. Estados visuais:
   - `Pendente`
   - `Concluído`
4. Atualização automática:
   - cada ação de sucesso marca o passo correspondente.
5. Persistência:
   - progresso salvo em `localStorage` (`waba.meta.guide`) para manter estado após refresh.

# Arquivos criados/alterados

- `index.html` (alterado)
- `dist/index.html` (atualizado via build)
- `doc/LOG-2026-03-27__140257__validacao-guiada-checklist-api-meta.md` (novo)

# Como validar

1. Abrir `1) Ativos API`.
2. Verificar checklist inicialmente em `Pendente`.
3. Executar ações das fases:
   - preencher credenciais;
   - listar números;
   - registrar número;
   - inscrever app;
   - criar template;
   - disparar template.
4. Confirmar mudança para `Concluído` nos itens correspondentes.
5. Recarregar a página e validar persistência do progresso.

# Observações de segurança

- Mudança apenas de UX/estado local no frontend.
- Sem armazenamento de token no backend.
- Checklist não altera lógica de envio; atua como guia operacional.

# Itens para evitar duplicação no futuro (palavras-chave)

- validacao-guiada
- checklist-api-meta
- onboarding-steps
- localstorage-progress
