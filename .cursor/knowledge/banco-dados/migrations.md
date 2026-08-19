\# Migrations - Padrões Gerais



\## Objetivo



Este documento define boas práticas gerais para gerenciamento de migrations de banco de dados em qualquer projeto.



O Cursor Agent deve consultar este arquivo antes de criar, alterar ou executar migrations.



Este documento não define:



\- estrutura de tabelas específicas;

\- ferramenta obrigatória de migration;

\- regras de negócio;

\- modelo de dados de aplicações.



Cada projeto deve possuir suas próprias migrations conforme sua arquitetura.



\---



\# Conceito de Migration



Migration representa uma alteração controlada na estrutura ou configuração do banco de dados.



Exemplos:



\- criação de tabelas;

\- alteração de colunas;

\- criação de índices;

\- criação de constraints;

\- ajustes de permissões;

\- alterações estruturais.



Toda alteração relevante deve possuir rastreabilidade.



\---



\# Análise Antes de Criar uma Migration



Antes de criar uma nova migration:



O Cursor Agent deve:



1\. analisar a estrutura atual do banco;

2\. verificar migrations existentes;

3\. identificar dependências;

4\. avaliar impacto nos dados;

5\. confirmar se a alteração é realmente necessária.



Nunca criar migrations duplicadas ou conflitantes.



\---



\# Organização das Migrations



Migrations devem possuir:



\- identificação clara;

\- ordem de execução;

\- descrição objetiva;

\- histórico preservado.



Cada migration deve representar uma alteração específica.



Evitar migrations com muitas alterações independentes misturadas.



\---



\# Nomenclatura



Utilizar nomes descritivos.



Exemplos:



```text

create\_users\_table

add\_status\_column\_to\_orders

create\_index\_on\_customers\_email

Evitar:
update1

fix

alteracao\_final

teste

O nome deve permitir entender o objetivo da alteração.



Alterações Estruturais



Antes de alterar estruturas existentes:



Avaliar:



dados já existentes;

aplicações dependentes;

impacto em consultas;

possibilidade de quebra.



Alterações destrutivas devem possuir planejamento.



Criação de Tabelas



Ao criar tabelas através de migrations:



Considerar:



chave primária;

tipos corretos;

relacionamentos;

índices;

constraints;

auditoria quando necessário.



A estrutura criada deve seguir os padrões definidos pelo projeto.



Alteração de Colunas



Antes de modificar uma coluna:



Avaliar:



dados existentes;

compatibilidade;

aplicações que utilizam o campo;

necessidade de migração de dados.



Evitar alterações que causem perda de informação.



Remoção de Dados ou Estruturas



Operações como:



DROP TABLE;

DROP COLUMN;

exclusões em massa;



devem ser realizadas com extremo cuidado.



Antes de executar:



Avaliar:



backup;

impacto;

possibilidade de recuperação;

dependências.

Dados Existentes



Quando uma migration altera dados:



Considerar:



volume de registros;

tempo de execução;

impacto no sistema;

possibilidade de rollback.



Evitar operações pesadas sem planejamento.



Rollback



Sempre que possível, migrations devem considerar reversão.



Avaliar:



como desfazer a alteração;

impacto dos dados gerados;

dependências criadas.



Nem toda alteração possui rollback simples, portanto deve ser analisada.



Ambientes



Migrations devem ser testadas antes de produção.



Considerar ambientes:



desenvolvimento;

homologação;

produção.



Nunca executar alterações experimentais diretamente em ambiente crítico.



Execução em Produção



Antes de executar migrations em produção:



Validar:



backup disponível;

migration testada;

impacto conhecido;

janela adequada;

plano de recuperação.

Controle de Versão



Migrations devem acompanhar o código da aplicação.



Manter:



histórico no Git;

revisão das alterações;

rastreabilidade.



Evitar migrations fora do controle de versão.



Conflitos de Migration



Quando houver múltiplas alterações:



Avaliar:



ordem de execução;

dependências;

conflitos;

compatibilidade.



Evitar criar migrations que dependam de alterações ainda não aplicadas.



Performance



Antes de migrations pesadas:



Avaliar:



quantidade de dados;

tempo esperado;

impacto nos usuários;

necessidade de execução em etapas.

Segurança



Nunca colocar em migrations:



senhas;

tokens;

credenciais;

informações sensíveis expostas.



Credenciais devem ser tratadas através de mecanismos seguros.



Validação Após Migration



Após executar uma migration:



Validar:



estrutura criada;

dados preservados;

aplicação funcionando;

consultas afetadas;

logs de erro.

Alterações em Projetos Existentes



Antes de modificar migrations existentes:



O Cursor Agent deve:



entender o histórico;

verificar se já foi aplicada;

avaliar impacto;

evitar alterar migrations antigas aplicadas em produção;

criar uma nova migration quando necessário.

Regra Final



O Cursor Agent nunca deve assumir:



ferramenta de migration utilizada;

estado atual do banco;

migrations aplicadas;

possibilidade de alteração direta.



Sempre deve analisar o histórico e a estrutura atual antes de criar ou executar migrations.



O objetivo é garantir:



segurança;

rastreabilidade;

consistência;

facilidade de manutenção.

