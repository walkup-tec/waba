\# Tailwind CSS - Padrões Gerais



\## Objetivo



Este documento define boas práticas gerais para utilização do Tailwind CSS em qualquer projeto.



O Cursor Agent deve utilizar estas orientações como referência ao criar ou alterar interfaces utilizando Tailwind CSS.



O agente nunca deve assumir:



\- paleta de cores;

\- identidade visual;

\- componentes existentes;

\- configuração específica;

\- convenções próprias do projeto.



Sempre analisar o projeto atual antes de implementar.



\---



\# Análise Antes da Implementação



Antes de criar ou alterar estilos utilizando Tailwind:



O Cursor Agent deve:



1\. analisar a configuração existente;

2\. verificar classes e padrões utilizados;

3\. identificar componentes reutilizáveis;

4\. respeitar o design existente;

5\. evitar criar estilos inconsistentes.



\---



\# Organização de Estilos



O Tailwind deve ser utilizado para manter estilos próximos da estrutura dos componentes.



Priorizar:



\- clareza;

\- manutenção simples;

\- reutilização adequada;

\- consistência visual.



Evitar:



\- arquivos CSS desnecessários;

\- estilos duplicados;

\- classes excessivamente complexas.



\---



\# Classes Tailwind



As classes devem permanecer organizadas e legíveis.



Priorizar:



\- agrupamento lógico;

\- facilidade de leitura;

\- consistência.



Evitar:



\- sequências excessivamente longas de classes;

\- repetição desnecessária;

\- estilos difíceis de manter.



\---



\# Responsividade



Toda interface deve considerar diferentes tamanhos de tela.



Avaliar:



\- desktop;

\- tablet;

\- mobile.



Utilizar os recursos responsivos do Tailwind quando necessário.



Não assumir que uma interface funcionará corretamente em todos os dispositivos.



\---



\# Design System



Quando o projeto possuir identidade visual definida:



O Cursor Agent deve respeitar:



\- cores;

\- espaçamentos;

\- tipografia;

\- tamanhos;

\- componentes existentes.



Nunca criar uma nova identidade visual sem solicitação.



\---



\# Cores



Antes de utilizar cores:



Verificar:



\- variáveis existentes;

\- tokens de design;

\- configuração do Tailwind.



Evitar utilizar cores aleatórias diretamente nas classes quando o projeto possuir padrão definido.



\---



\# Espaçamento e Layout



Manter consistência utilizando:



\- sistema de espaçamento existente;

\- padrões de layout;

\- componentes reutilizáveis.



Evitar valores arbitrários espalhados pelo projeto.



\---



\# Componentização



Quando um conjunto de estilos se repetir:



Avaliar criação de:



\- componentes reutilizáveis;

\- variantes;

\- abstrações.



Evitar copiar e colar grandes blocos de classes.



\---



\# Estados da Interface



Componentes devem considerar estados como:



\- normal;

\- hover;

\- foco;

\- carregamento;

\- desabilitado;

\- erro.



Garantir boa experiência de uso.



\---



\# Acessibilidade



Os estilos devem preservar acessibilidade.



Considerar:



\- contraste adequado;

\- foco visível;

\- tamanhos adequados;

\- navegação por teclado.



\---



\# Performance



Avaliar:



\- tamanho final do CSS;

\- classes utilizadas;

\- componentes carregados.



Evitar configurações ou dependências desnecessárias.



\---



\# Configuração



Antes de alterar:



\- tailwind.config;

\- temas;

\- plugins;

\- variáveis;



o Cursor Agent deve analisar o impacto no projeto.



Alterações globais devem ser feitas com cuidado.



\---



\# Integração com Componentes



Ao utilizar bibliotecas de componentes:



Avaliar compatibilidade entre:



\- Tailwind;

\- componentes existentes;

\- tokens de design;

\- estilos globais.



Evitar sobrescrever estilos sem necessidade.



\---



\# Alterações em Projetos Existentes



Antes de modificar estilos:



O Cursor Agent deve:



1\. identificar componentes afetados;

2\. verificar padrões visuais;

3\. avaliar impacto;

4\. alterar somente o necessário;

5\. validar o resultado.



\---



\# Regra Final



O Cursor Agent nunca deve assumir:



\- cores;

\- tema;

\- layout;

\- padrões visuais;

\- configuração Tailwind.



Sempre deve analisar o projeto atual antes de criar ou modificar estilos utilizando Tailwind CSS.

