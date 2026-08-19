\# PostgreSQL - Padrões Gerais



\## Objetivo



Este documento define boas práticas gerais para utilização do PostgreSQL em qualquer projeto.



O Cursor Agent deve utilizar estas orientações como referência, mas nunca deve assumir estruturas específicas de banco, tabelas, campos ou regras de negócio.



Cada projeto possui sua própria arquitetura e documentação complementar.



\---



\# Análise Antes da Implementação



Antes de criar ou alterar qualquer estrutura PostgreSQL, o Cursor Agent deve:



1\. analisar o banco existente;

2\. identificar padrões utilizados;

3\. verificar relacionamentos atuais;

4\. entender o impacto da alteração;

5\. evitar duplicação de estruturas.



Nunca criar tabelas, campos ou relacionamentos sem avaliar a necessidade real.



\---



\# Modelagem de Dados



A modelagem deve priorizar:



\- organização dos dados;

\- consistência;

\- manutenção simples;

\- escalabilidade;

\- performance.



Antes de criar uma nova entidade:



Avaliar:



\- se já existe estrutura equivalente;

\- se o dado pertence realmente ao banco;

\- se o relacionamento está correto;

\- se a solução atende o crescimento futuro.



\---



\# Nomenclatura



Seguir padrões consistentes definidos pelo projeto.



Como regra geral:



\- utilizar nomes claros;

\- evitar abreviações confusas;

\- manter padrão único em toda aplicação.



Exemplos genéricos:
usuarios

pedidos

historicos

configurações



Evitar:

tab1

tmp\_data

dados\_novo2



\---



\# Tipos de Dados



Escolher tipos adequados conforme a necessidade.



Avaliar:



\- volume esperado;

\- precisão necessária;

\- comportamento dos dados.



Exemplos:



Texto:

\- utilizar tipos adequados ao tamanho e necessidade.



Valores numéricos:

\- considerar precisão quando envolver valores financeiros.



Datas:

\- considerar timezone quando houver aplicações distribuídas.



\---



\# Chaves Primárias



Toda tabela deve possuir uma identificação única.



O padrão utilizado deve seguir a arquitetura do projeto.



Avaliar:



\- UUID;

\- identificadores sequenciais;

\- necessidade de exposição externa.



Nunca assumir um padrão sem verificar o projeto atual.



\---



\# Relacionamentos



Relacionamentos devem ser planejados considerando:



\- integridade dos dados;

\- facilidade de consulta;

\- performance.



Utilizar recursos adequados:



\- foreign keys;

\- constraints;

\- índices.



Evitar armazenar informações relacionadas como texto duplicado.



\---



\# Constraints



Utilizar restrições quando necessário para garantir qualidade dos dados.



Exemplos:



\- campos obrigatórios;

\- valores únicos;

\- regras de validação;

\- integridade referencial.



As regras devem existir no local mais adequado entre:



\- aplicação;

\- banco;

\- ambos.



\---



\# Índices



Criar índices quando houver necessidade real.



Avaliar:



\- frequência de consultas;

\- filtros utilizados;

\- ordenações;

\- volume de dados.



Evitar criar índices sem análise, pois eles podem impactar operações de escrita.



\---



\# Queries



As consultas devem priorizar:



\- clareza;

\- performance;

\- manutenção.



Boas práticas:



\- buscar somente campos necessários;

\- evitar consultas excessivamente amplas;

\- analisar consultas lentas;

\- utilizar recursos nativos do PostgreSQL quando apropriado.



\---



\# Migrations



Toda alteração estrutural deve ser versionada.



Exemplos:



\- criação de tabelas;

\- alteração de campos;

\- criação de índices;

\- alteração de constraints.



As migrations devem permitir:



\- rastreamento das mudanças;

\- reprodução do ambiente;

\- histórico da evolução do banco.



Evitar alterações manuais sem registro.



\---



\# Performance



Antes de otimizar:



1\. identificar o problema;

2\. medir impacto;

3\. analisar consultas;

4\. verificar estrutura existente.



Evitar otimizações baseadas apenas em suposição.



Avaliar:



\- índices;

\- volume de dados;

\- consultas;

\- arquitetura da aplicação.



\---



\# Segurança



Considerar:



\- controle de acesso;

\- proteção de dados sensíveis;

\- permissões mínimas;

\- auditoria quando necessário.



Nunca armazenar informações sensíveis sem necessidade.



\---



\# Backup e Recuperação



Projetos críticos devem considerar:



\- estratégia de backup;

\- recuperação de dados;

\- testes de restauração;

\- retenção adequada.



\---



\# Alterações em Projetos Existentes



Antes de alterar o banco:



O Cursor Agent deve:



1\. identificar componentes afetados;

2\. verificar dependências;

3\. avaliar impacto;

4\. criar alteração compatível;

5\. validar funcionamento.



\---



\# Regra Final



O Cursor Agent nunca deve assumir:



\- tabelas existentes;

\- nomes de campos;

\- estrutura do banco;

\- regras específicas do negócio.



Sempre deve analisar o projeto atual antes de implementar qualquer alteração PostgreSQL.



