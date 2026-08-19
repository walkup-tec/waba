\# PostgreSQL - Padrões Gerais



\## Objetivo



Este documento define padrões gerais para utilização do PostgreSQL em qualquer projeto.



O Cursor Agent deve consultar este arquivo antes de criar, alterar ou analisar estruturas, consultas ou integrações utilizando PostgreSQL.



Este documento não define:



\- tabelas específicas;

\- modelos de negócio;

\- campos obrigatórios de aplicações;

\- regras de domínio.



Cada projeto deve possuir sua própria documentação de banco de dados.



\---



\# Análise Antes da Implementação



Antes de criar ou modificar qualquer recurso PostgreSQL:



O Cursor Agent deve:



1\. analisar a estrutura existente;

2\. verificar tabelas e relacionamentos;

3\. identificar dependências;

4\. avaliar impacto da alteração;

5\. evitar alterações desnecessárias.



Nunca criar estruturas duplicadas sem análise.



\---



\# Modelagem de Dados



Antes de criar tabelas:



Avaliar:



\- necessidade da informação;

\- relacionamento entre entidades;

\- crescimento esperado;

\- impacto nas consultas;

\- manutenção futura.



Priorizar:



\- organização;

\- consistência;

\- clareza.



\---



\# Nomenclatura



Utilizar padrões consistentes.



Preferir:



\- letras minúsculas;

\- snake\_case;

\- nomes descritivos;

\- padronização entre objetos.



Exemplos:



```text

clientes

pedidos

created\_at

updated\_at

Evitar:



nomes abreviados sem contexto;

caracteres especiais;

mistura de padrões.

Tabelas



Ao criar tabelas:



Considerar:



chave primária;

relacionamentos;

índices necessários;

constraints;

auditoria.



Sempre avaliar se a tabela realmente representa uma entidade independente.



Chaves Primárias



Toda tabela deve possuir identificação única quando aplicável.



Considerar:



UUID;

sequências;

identificadores naturais.



A escolha deve considerar:



arquitetura;

escala;

integrações existentes.

Relacionamentos



Relacionamentos devem ser claros.



Avaliar:



chaves estrangeiras;

integridade dos dados;

cardinalidade;

necessidade de índices.



Evitar relacionamentos sem documentação.



Índices



Criar índices considerando:



consultas frequentes;

filtros utilizados;

ordenações;

relacionamentos.



Evitar criar índices excessivos sem necessidade.



Índices aumentam velocidade de leitura, mas podem impactar operações de escrita.



Constraints



Utilizar constraints quando necessário para garantir integridade.



Considerar:



NOT NULL;

UNIQUE;

CHECK;

FOREIGN KEY.



Regras importantes devem preferencialmente existir também no banco.



Tipos de Dados



Escolher tipos adequados.



Avaliar:



tamanho esperado;

precisão;

performance;

compatibilidade.



Evitar utilizar tipos genéricos quando existe uma opção mais adequada.



Consultas SQL



Antes de criar consultas:



Avaliar:



quantidade de dados;

filtros utilizados;

necessidade de índices;

desempenho esperado.



Evitar:



consultas desnecessariamente complexas;

busca de dados sem filtro;

processamento excessivo no banco.

Transações



Operações que envolvem múltiplas alterações devem considerar transações.



Objetivos:



garantir consistência;

evitar dados incompletos;

permitir recuperação em caso de erro.

Funções e Procedures



Antes de criar lógica dentro do banco:



Avaliar:



necessidade real;

manutenção;

complexidade;

impacto futuro.



Evitar concentrar regras de negócio excessivas no banco sem necessidade.



Segurança



Considerar:



usuários de banco;

permissões;

acesso mínimo necessário;

proteção de credenciais.



Nunca utilizar usuários administrativos em aplicações sem necessidade.



Backup e Recuperação



Bancos importantes devem possuir:



estratégia de backup;

testes de restauração;

controle de versões;

monitoramento.



Um backup não testado não garante recuperação.



Performance



Ao identificar lentidão:



Analisar:



consultas executadas;

plano de execução;

índices;

volume de dados;

recursos disponíveis.



Evitar otimizações baseadas apenas em tentativa e erro.



Migrações



Alterações estruturais devem ser registradas.



Considerar:



histórico;

ordem de execução;

compatibilidade;

rollback.



Nunca alterar produção sem controle da mudança.



Ambientes



Quando aplicável:



Separar:



desenvolvimento;

testes;

produção.



Evitar executar alterações experimentais em ambientes críticos.



Logs e Diagnóstico



Ao investigar problemas:



Analisar:



erros do banco;

consultas lentas;

conexões;

consumo de recursos;

alterações recentes.

Alterações em Projetos Existentes



Antes de modificar PostgreSQL:



O Cursor Agent deve:



entender a estrutura atual;

identificar aplicações dependentes;

avaliar impacto;

documentar alterações;

validar funcionamento.

Regra Final



O Cursor Agent nunca deve assumir:



estrutura do banco;

tabelas existentes;

regras de negócio;

permissões;

volume de dados.



Sempre deve analisar o PostgreSQL existente antes de criar ou modificar qualquer recurso.



O objetivo é manter:



integridade dos dados;

segurança;

performance;

facilidade de manutenção.

