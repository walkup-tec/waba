\# Next.js - Padrões Gerais



\## Objetivo



Este documento define boas práticas gerais para utilização do Next.js em qualquer projeto.



O Cursor Agent deve utilizar estas orientações como referência ao desenvolver, corrigir ou evoluir aplicações utilizando Next.js.



O agente nunca deve assumir:



\- versão específica do Next.js;

\- estrutura de rotas;

\- arquitetura de pastas;

\- estratégia de renderização;

\- bibliotecas adicionais.



Sempre analisar o projeto atual antes de implementar.



\---



\# Análise Antes da Implementação



Antes de criar ou alterar funcionalidades Next.js, o Cursor Agent deve:



1\. analisar a estrutura existente;

2\. identificar o padrão de rotas utilizado;

3\. verificar componentes existentes;

4\. entender estratégia de renderização;

5\. manter compatibilidade com a arquitetura atual.



Evitar introduzir padrões diferentes sem necessidade.



\---



\# Estrutura de Projeto



A organização deve seguir um padrão consistente.



Avaliar a separação entre:



\- páginas/rotas;

\- componentes;

\- layouts;

\- serviços;

\- hooks;

\- utilidades;

\- configurações.



A estrutura escolhida deve facilitar:



\- manutenção;

\- escalabilidade;

\- entendimento do código.



\---



\# Renderização



O Cursor Agent deve avaliar corretamente quando utilizar:



\- Server Components;

\- Client Components;

\- renderização no servidor;

\- renderização no cliente;

\- geração estática;

\- carregamento dinâmico.



Não utilizar componentes cliente sem necessidade.



\---



\# Componentes



Componentes devem:



\- possuir responsabilidade clara;

\- ser reutilizáveis quando aplicável;

\- evitar lógica excessiva;

\- manter separação entre interface e regras de negócio.



Evitar páginas com grande quantidade de lógica misturada.



\---



\# Rotas



Antes de criar novas rotas:



Avaliar:



\- padrão existente;

\- organização atual;

\- impacto em navegação;

\- compatibilidade.



Manter URLs claras e previsíveis.



\---



\# Layouts



Layouts devem ser utilizados para elementos compartilhados.



Exemplos:



\- menus;

\- cabeçalhos;

\- estruturas comuns;

\- providers.



Evitar duplicar estruturas entre páginas.



\---



\# Busca de Dados



A estratégia de carregamento de dados deve considerar:



\- origem dos dados;

\- necessidade de atualização;

\- performance;

\- experiência do usuário.



Evitar buscar dados desnecessariamente no cliente.



\---



\# Integração com APIs



Chamadas externas devem seguir padrões organizados.



Considerar:



\- separação de serviços;

\- tratamento de erros;

\- loading;

\- cache quando aplicável;

\- segurança.



Evitar chamadas espalhadas diretamente nos componentes.



\---



\# Variáveis de Ambiente



Nunca armazenar:



\- URLs privadas;

\- tokens;

\- chaves;

\- credenciais;



diretamente no código.



Utilizar variáveis de ambiente adequadamente.



Separar configurações:



\- desenvolvimento;

\- homologação;

\- produção.



\---



\# Performance



Avaliar:



\- tamanho dos bundles;

\- carregamento de páginas;

\- imagens;

\- componentes pesados;

\- chamadas desnecessárias.



Evitar otimizações prematuras sem análise.



\---



\# SEO



Quando aplicável, considerar:



\- títulos;

\- descrições;

\- metadados;

\- estrutura semântica;

\- performance.



\---



\# Segurança



O frontend nunca deve ser considerado uma camada segura.



Regras importantes devem existir no backend.



Considerar:



\- proteção de dados;

\- validação;

\- autenticação;

\- autorização.



\---



\# Dependências



Antes de adicionar bibliotecas:



Avaliar:



\- necessidade real;

\- impacto no projeto;

\- manutenção futura;

\- compatibilidade.



Evitar dependências desnecessárias.



\---



\# Alterações em Projetos Existentes



Antes de modificar uma aplicação Next.js:



O Cursor Agent deve:



1\. entender a arquitetura atual;

2\. verificar componentes relacionados;

3\. avaliar impactos;

4\. alterar somente o necessário;

5\. validar funcionamento.



\---



\# Regra Final



O Cursor Agent nunca deve assumir:



\- estrutura de páginas;

\- padrão de rotas;

\- versão do Next.js;

\- estratégia de renderização;

\- bibliotecas utilizadas.



Sempre deve analisar o projeto atual antes de implementar qualquer alteração em Next.js.

