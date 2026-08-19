\# SQL - Padrões Gerais



\## Objetivo



Este documento define boas práticas gerais para utilização de SQL em qualquer projeto.



O Cursor Agent deve consultar este arquivo antes de criar, alterar ou analisar consultas SQL, scripts ou comandos relacionados ao banco de dados.



Este documento não define:



\- tabelas específicas;

\- consultas específicas da aplicação;

\- regras de negócio;

\- estrutura de dados de projetos.



Cada projeto deve possuir sua própria documentação de banco e modelos de dados.



\---



\# Análise Antes de Criar SQL



Antes de criar qualquer consulta SQL:



O Cursor Agent deve:



1\. entender a estrutura existente;

2\. verificar tabelas e relacionamentos;

3\. identificar índices disponíveis;

4\. compreender o objetivo da consulta;

5\. avaliar impacto de performance.



Nunca criar consultas sem entender o modelo de dados.



\---



\# Organização das Consultas



As consultas devem priorizar:



\- clareza;

\- legibilidade;

\- manutenção simples;

\- eficiência.



Preferir:



\- nomes claros;

\- indentação adequada;

\- organização por blocos lógicos.



Evitar consultas difíceis de interpretar.



\---



\# SELECT



Ao utilizar SELECT:



Considerar:



\- retornar somente os campos necessários;

\- evitar SELECT \* sem necessidade;

\- utilizar filtros adequados;

\- avaliar volume de dados retornado.



Excesso de dados retornados pode causar:



\- lentidão;

\- maior consumo de recursos;

\- problemas de performance.



\---



\# WHERE e Filtros



Filtros devem ser utilizados corretamente.



Avaliar:



\- campos utilizados em buscas frequentes;

\- tipos dos dados;

\- possibilidade de utilização de índices.



Evitar consultas sem filtros em tabelas grandes quando não necessário.



\---



\# JOINs



Antes de utilizar JOINs:



Avaliar:



\- relacionamento entre tabelas;

\- quantidade de registros envolvidos;

\- impacto da consulta.



Utilizar JOINs de forma clara e organizada.



Evitar combinações que gerem volume excessivo de dados.



\---



\# INSERT



Ao inserir dados:



Considerar:



\- validação dos dados;

\- campos obrigatórios;

\- tratamento de erros;

\- integridade das informações.



Evitar inserir dados incompletos ou inconsistentes.



\---



\# UPDATE



Antes de executar UPDATE:



Confirmar:



\- registros afetados;

\- condição WHERE correta;

\- impacto da alteração.



Nunca executar UPDATE sem filtro quando houver risco de alterar dados indevidos.



\---



\# DELETE



Operações DELETE devem possuir cuidado adicional.



Antes de remover dados:



Avaliar:



\- necessidade da exclusão;

\- possibilidade de recuperação;

\- impacto em relacionamentos;

\- existência de backup.



Evitar exclusões irreversíveis sem planejamento.



\---



\# Transações



Operações envolvendo múltiplas alterações devem considerar transações.



Objetivos:



\- manter consistência;

\- evitar dados parcialmente alterados;

\- permitir recuperação em caso de erro.



Exemplo:



```sql

BEGIN;



\-- alterações



COMMIT;

Em caso de falha:
ROLLBACK;

Segurança SQL



Sempre considerar segurança contra:



SQL Injection;

exposição de dados;

acesso indevido.



Preferir:



consultas parametrizadas;

validação de entradas;

controle de permissões.



Nunca concatenar dados externos diretamente em comandos SQL.



Performance



Antes de otimizar consultas:



Analisar:



volume de dados;

plano de execução;

índices existentes;

frequência de utilização.



Evitar otimizações baseadas apenas em tentativa e erro.



Índices



Ao criar consultas:



Considerar se os campos utilizados possuem índices adequados.



Avaliar:



filtros frequentes;

ordenações;

relacionamentos.



Evitar criar índices sem necessidade.



Paginação



Para grandes volumes de dados:



Utilizar estratégias de paginação.



Considerar:



LIMIT;

OFFSET;

paginação baseada em cursor quando necessário.



Evitar carregar grandes volumes de dados de uma única vez.



Agregações



Ao utilizar:



COUNT;

SUM;

AVG;

GROUP BY;



Avaliar:



quantidade de dados processados;

necessidade de índices;

impacto da consulta.

Views



Antes de criar Views:



Avaliar:



necessidade real;

frequência de uso;

impacto de manutenção.



Views devem facilitar acesso aos dados, não esconder complexidade excessiva.



Procedures e Functions



Antes de criar lógica no banco:



Avaliar:



necessidade;

manutenção;

impacto;

responsabilidade da aplicação.



Evitar concentrar toda lógica de negócio no banco sem necessidade.



Scripts SQL



Scripts devem possuir:



identificação clara;

comentários quando necessário;

validações;

cuidado com alterações destrutivas.



Evitar scripts sem contexto.



Dados Sensíveis



Ao consultar dados:



Considerar:



privacidade;

necessidade de acesso;

exposição mínima.



Evitar retornar ou armazenar informações sensíveis sem necessidade.



Testes



Antes de executar SQL em produção:



Validar:



resultado esperado;

registros afetados;

performance;

impacto.



Sempre testar consultas críticas previamente.



Alterações em Projetos Existentes



Antes de modificar SQL existente:



O Cursor Agent deve:



entender o objetivo atual;

verificar dependências;

avaliar impacto;

manter compatibilidade;

validar funcionamento.

Regra Final



O Cursor Agent nunca deve assumir:



estrutura das tabelas;

quantidade de dados;

regras de negócio;

permissões existentes;

banco utilizado.



Sempre deve analisar o contexto atual antes de criar ou modificar comandos SQL.



O objetivo é manter:



segurança;

performance;

qualidade;

facilidade de manutenção.

