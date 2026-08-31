# LOG — Relatório operacional: inputs travados

## Problema

Operacional abria o relatório da campanha e não conseguia digitar nos campos — clicava nos cards de métricas (Enviados, Entregues, etc.) sem efeito.

## Causa

1. **Duplicação visual:** formulário editável no topo + preview com cards idênticos (somente leitura) abaixo — usuário clicava no preview.
2. **Reset incompleto ao fechar modal:** após ver relatório finalizado, inputs podiam permanecer `disabled` ao abrir campanha em andamento.
3. Formulário de entrada podia ficar fora da área visível ao rolar o modal.

## Solução

1. Seção **"Registrar resultados"** com hint explicativo no topo.
2. Em modo edição, **ocultar** a linha duplicada "Contagem de Mensagens" no dashboard (mantém gráficos/taxas).
3. Entry **sticky** no topo do modal + foco automático no primeiro campo.
4. `closeAdminCampanhasReportModal` chama `setAdminCampanhasReportReadOnly(false)` para reset completo.
5. Estado de carregamento com `.is-loading` (sem travar inputs permanentemente).
6. Estilo visual de foco nos inputs editáveis.

## Arquivos

- `index.html`, `dist/index.html`
- `src/deploy-marker.ts`

## Validar

1. Campanha **em andamento** → Relatório → digitar Enviados/Entregues/Lidos/Falhados.
2. Campanha **finalizada** → Ver relatório → somente leitura (sem formulário).
3. Abrir finalizada, fechar, abrir em andamento → inputs editáveis.

## Palavras-chave

`operacional`, `relatório`, `campanha`, `inputs`, `readonly`, `admin-campanhas-report`
