\# React - Padrões Gerais



\## Objetivo



Este documento define boas práticas gerais para utilização do React em qualquer projeto.



O Cursor Agent deve utilizar estas orientações como referência ao desenvolver, corrigir ou evoluir aplicações React.



O agente nunca deve assumir:



\- estrutura de componentes;

\- organização de pastas;

\- bibliotecas utilizadas;

\- padrões específicos do projeto.



Sempre analisar a arquitetura existente antes de implementar.



\---



\# Análise Antes da Implementação



Antes de criar componentes ou alterar código React, o Cursor Agent deve:



1\. analisar a estrutura atual;

2\. identificar padrões existentes;

3\. verificar componentes reutilizáveis;

4\. entender gerenciamento de estado utilizado;

5\. evitar criar soluções paralelas.



Manter consistência com o projeto existente.



\---



\# Componentização



Os componentes devem seguir o princípio de responsabilidade única.



Um componente deve:



\- possuir uma finalidade clara;

\- evitar excesso de responsabilidades;

\- ser reutilizável quando fizer sentido;

\- possuir código organizado.



Evitar componentes gigantes com muitas regras misturadas.



\---



\# Organização de Código



Manter separação entre:



\- componentes visuais;

\- regras de negócio;

\- chamadas de API;

\- hooks;

\- utilidades;

\- configurações.



Evitar colocar lógica complexa diretamente dentro da interface.



\---



\# Componentes Reutilizáveis



Antes de criar um novo componente:



Verificar se:



\- já existe componente semelhante;

\- pode ser criada uma abstração reutilizável;

\- a solução atende futuras necessidades.



Evitar duplicação de código.



\---



\# Props



As propriedades dos componentes devem:



\- possuir nomes claros;

\- representar corretamente sua finalidade;

\- evitar excesso de parâmetros;

\- possuir validação quando necessário.



Evitar passar objetos grandes sem necessidade.



\---



\# Estado da Aplicação



Antes de criar estados:



Avaliar:



\- se o estado realmente precisa existir;

\- onde ele deve ficar;

\- quem precisa acessar essa informação.



Evitar estados duplicados ou espalhados.



\---



\# Hooks



Hooks devem ser utilizados de forma organizada.



Considerar:



\- criação de hooks personalizados quando houver lógica repetida;

\- evitar efeitos desnecessários;

\- controlar corretamente dependências.



Evitar colocar regras complexas diretamente em hooks de ciclo de vida.



\---



\# Performance



Considerar:



\- renderizações desnecessárias;

\- componentes pesados;

\- carregamentos excessivos;

\- divisão de código quando necessário.



Não aplicar otimizações sem necessidade real.



\---



\# Comunicação com APIs



As chamadas externas devem possuir separação adequada.



Evitar:



\- chamadas HTTP diretamente espalhadas pelos componentes;

\- duplicação de lógica;

\- tratamento inconsistente de erros.



Preferir uma camada organizada para comunicação externa.



\---



\# Tratamento de Erros



Interfaces devem considerar:



\- carregamento;

\- sucesso;

\- erro;

\- ausência de dados.



Evitar deixar estados indefinidos para o usuário.



\---



\# Acessibilidade



Componentes devem considerar:



\- elementos semânticos;

\- navegação por teclado;

\- textos alternativos;

\- boa experiência de uso.



\---



\# Segurança



O React não deve ser tratado como camada de segurança.



Nunca confiar apenas na validação do frontend.



Regras críticas devem existir também no backend.



\---



\# Código Limpo



O código deve priorizar:



\- legibilidade;

\- nomes claros;

\- baixo acoplamento;

\- fácil manutenção.



Evitar:



\- código duplicado;

\- funções gigantes;

\- comentários explicando código mal estruturado.



\---



\# Alterações em Projetos Existentes



Antes de modificar componentes:



O Cursor Agent deve:



1\. entender o fluxo atual;

2\. identificar dependências;

3\. avaliar impactos;

4\. realizar alterações mínimas;

5\. validar funcionamento.



\---



\# Regra Final



O Cursor Agent nunca deve assumir:



\- arquitetura React;

\- estrutura de componentes;

\- bibliotecas;

\- padrões de estado.



Sempre deve analisar o projeto atual antes de criar ou modificar código React.

