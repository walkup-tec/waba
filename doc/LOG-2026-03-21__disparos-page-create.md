# LOG: Página Disparos criada

**Data:** 2026-03-21  
**Tarefa:** Criar página Disparos pronta para receber regras, variáveis e pontos críticos

## Contexto

Usuário solicitou uma nova página chamada **Disparos** no sistema. A página deve ficar pronta para, posteriormente, receber as regras, variáveis e pontos críticos que serão informados.

## Solução implementada

### 1. Nova aba na navegação

- Botão **Disparos** adicionado nas abas desktop e mobile (drawer)
- `data-tab="disparos"` para integração com o sistema de tabs existente

### 2. Painel `tab-disparos`

Layout em duas colunas (inspirado na página Aquecedor):

**Coluna esquerda – Resumo e configuração**
- Cards de resumo: Enviados hoje, Na fila, Instância ativa (valores placeholder `—`)
- Área **Variáveis e regras** (`#disparos-config-area`): placeholder para definição futura

**Coluna direita – Atividade**
- Título + botão Atualizar
- Lista de atividade recente (`#disparos-list`): placeholder "Carregando ou aguardando dados..."

### 3. Lógica de exibição

- `setActiveTab()` atualizado para exibir/ocultar o painel Disparos
- Dashboard filters ocultos quando a aba Disparos está ativa (igual Aquecedor/Instâncias)
- Botão Atualizar com handler placeholder (toast "Dados de disparos serão carregados em breve")

### 4. CSS

- `.disparos-layout` – grid 1.2fr 0.8fr
- `.disparos-side` – painéis com borda e fundo
- `.disparos-config-area` – área tracejada para variáveis/regras
- `.disparos-list` – lista com scroll (max-height 480px)
- Responsivo: colunas empilham em viewports < 992px

## Arquivos alterados

- `index.html` – abas, painel HTML, CSS, JS (setActiveTab, handlers)

## Validação

1. Executar `npm start` e acessar a aplicação
2. Clicar na aba **Disparos**
3. Verificar layout (resumo, área de variáveis, atividade)
4. Clicar em **Atualizar** → deve exibir toast informativo

## Próximos passos (quando o usuário informar)

- Definir variáveis (ex.: limites diários, janela comercial, instâncias)
- Definir regras de negócio
- Implementar endpoints/APIs para dados reais
- Integrar com Redis/N8n (Lead_Corban, round_robin, etc.)

## Palavras-chave

- disparos
- tab-disparos
- disparos-config-area
- orquestrador-motor
- variaveis-regras
