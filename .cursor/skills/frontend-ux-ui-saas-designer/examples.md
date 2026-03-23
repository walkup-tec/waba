# Frontend & UX/UI Designer (SaaS) - Exemplos

## Exemplo 1: melhorar onboarding (produto financeiro)
**Usuário pede:** "Quero reduzir o tempo para ativar a conta no painel. Hoje o onboarding tem 6 passos e muitas dúvidas."

**Como o agente deve agir:**
1. Mapear o fluxo atual e identificar fricções (onde o usuário desiste, quais decisões exigem esforço).
2. Propor um fluxo mais curto (ex.: 2-3 telas) com CTAs claros e validações preventivas.
3. Descrever estados e feedbacks: loading, erro, vazio e sucesso.
4. Implementar com componentes reutilizáveis e layout responsivo.

## Exemplo 2: tela de lista com filtros e paginação
**Usuário pede:** "Criar uma tela de transações com filtros por período e paginação. O mobile está ruim."

**Como o agente deve agir:**
- Preferir layout mobile-first (cards/lista com actions claras).
- Garantir que filtros não escondam resultados (mostrar contagem e feedback de filtros sem resultados).
- Tratar estado vazio e erro de forma consistente com o design system.
- Evitar listas não paginadas e reduzir re-renders em filtros.

## Exemplo 3: componente de formulário com validação e UX de erro
**Usuário pede:** "Criar modal para criar fatura com validação e mensagens de erro amigáveis."

**Como o agente deve agir:**
1. Definir campos, tipos e regras de validação (ex.: datas, valores, campos obrigatórios).
2. Exibir erro junto do campo (mensagem objetiva e ação sugerida).
3. Garantir acesso por teclado e foco ao abrir/fechar modal.
4. Implementar loading e tratamento de falha de rede com mensagens seguras.

