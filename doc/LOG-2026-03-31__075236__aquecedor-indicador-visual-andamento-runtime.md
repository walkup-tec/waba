# LOG — Aquecedor: indicador visual de andamento em runtime

## Contexto (resumo)

Solicitado recurso visual no painel do Aquecedor para mostrar claramente o andamento após clicar em **Iniciar Aquecedor**.

## Ações executadas

1. Atualizado `index.html` com um bloco visual de progresso no runtime do Aquecedor:
   - barra de progresso (`track` + `fill`);
   - legenda de status.
2. Implementada lógica JS para renderizar o andamento:
   - **Motor parado**: barra em 0%;
   - **Processando agora**: barra animada (estado ativo);
   - **Aguardando próximo ciclo**: contagem regressiva em segundos com progresso;
   - **Pronto para próximo ciclo**: barra em 100%.
3. Adicionado polling do status do runtime (`/aquecedor/status`) e atualização visual contínua (cache + timer de 1s) enquanto a aba Aquecedor está ativa.
4. Executado `npm run build` e reiniciados os ambientes `3000` e `3010`.

## Arquivos alterados

- `index.html`
- `dist/index.html` (gerado pelo build)

## Como validar

1. Abrir aba Aquecedor.
2. Clicar em **Iniciar Aquecedor**.
3. Verificar:
   - legenda e barra mudando entre os estados;
   - contagem regressiva quando houver `nextAllowedAt`;
   - animação durante processamento.

## Segurança

- Sem exposição de credenciais/segredos.
- Apenas alterações visuais e de leitura de status já existente.

## Palavras-chave

`aquecedor-runtime-progress`, `loadAquecedorRuntimeStatus`, `renderAquecedorRuntimeProgress`, barra-progresso-aquecedor
