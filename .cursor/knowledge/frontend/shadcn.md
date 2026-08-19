\# shadcn/ui - Padrões Gerais



\## Objetivo



Este documento define boas práticas gerais para utilização do shadcn/ui em qualquer projeto.



O Cursor Agent deve utilizar estas orientações como referência ao criar interfaces utilizando componentes baseados em shadcn/ui.



O agente nunca deve assumir:



\- componentes já instalados;

\- tema visual;

\- configuração de estilos;

\- estrutura de pastas;

\- componentes customizados existentes.



Sempre analisar o projeto atual antes de implementar.



\---



\# Análise Antes da Implementação



Antes de criar novos componentes utilizando shadcn/ui, o Cursor Agent deve:



1\. verificar componentes existentes;

2\. identificar padrões visuais utilizados;

3\. avaliar se o componente já existe;

4\. evitar duplicação;

5\. manter consistência da interface.



\---



\# Uso dos Componentes



Os componentes shadcn/ui devem ser utilizados como base para construção da interface.



Priorizar:



\- reutilização;

\- consistência visual;

\- acessibilidade;

\- manutenção simples.



Evitar criar componentes personalizados quando um componente existente atende à necessidade.



\---



\# Customização



A customização deve respeitar a arquitetura do projeto.



Antes de alterar componentes:



Avaliar:



\- impacto visual;

\- impacto global;

\- compatibilidade;

\- necessidade real.



Evitar modificar componentes base sem entender onde são utilizados.



\---



\# Componentização



Separar:



\## Componentes de Interface



Responsáveis por:



\- apresentação;

\- interação visual;

\- estados da interface.



\## Regras de Negócio



Devem permanecer separadas.



Evitar colocar:



\- chamadas de API;

\- regras complexas;

\- processamento de dados;



diretamente dentro dos componentes visuais.



\---



\# Acessibilidade



Os componentes devem preservar boas práticas de acessibilidade.



Considerar:



\- navegação por teclado;

\- labels adequadas;

\- mensagens de erro claras;

\- estados de foco;

\- componentes semanticamente corretos.



\---



\# Formulários



Ao criar formulários:



Considerar:



\- validação adequada;

\- mensagens claras;

\- estados de carregamento;

\- feedback ao usuário.



Evitar formulários sem tratamento de erros.



\---



\# Estados da Interface



Componentes devem considerar:



\- carregando;

\- sucesso;

\- erro;

\- vazio;

\- indisponível.



Evitar deixar o usuário sem informação sobre o estado atual.



\---



\# Design System



Quando um projeto utiliza shadcn/ui:



O Cursor Agent deve respeitar:



\- tokens de design existentes;

\- cores definidas;

\- espaçamentos;

\- tipografia;

\- padrões visuais.



Evitar criar estilos isolados que quebrem a identidade visual.



\---



\# Temas



Alterações de tema devem considerar:



\- configuração existente;

\- modo claro/escuro;

\- variáveis de estilo;

\- impacto global.



Nunca alterar estilos globais sem avaliar consequências.



\---



\# Dependências



Antes de adicionar novos componentes:



Avaliar:



\- necessidade;

\- compatibilidade;

\- impacto no bundle;

\- manutenção futura.



Evitar instalar componentes ou bibliotecas sem necessidade.



\---



\# Performance



Considerar:



\- quantidade de componentes renderizados;

\- componentes pesados;

\- carregamentos desnecessários.



Não aplicar otimizações sem análise.



\---



\# Alterações em Projetos Existentes



Antes de modificar componentes shadcn/ui:



O Cursor Agent deve:



1\. identificar onde o componente é utilizado;

2\. verificar dependências;

3\. avaliar impacto visual;

4\. realizar alterações mínimas;

5\. validar funcionamento.



\---



\# Regra Final



O Cursor Agent nunca deve assumir:



\- componentes existentes;

\- configuração do shadcn/ui;

\- tema;

\- padrões visuais.



Sempre deve analisar o projeto atual antes de criar ou modificar componentes utilizando shadcn/ui.

