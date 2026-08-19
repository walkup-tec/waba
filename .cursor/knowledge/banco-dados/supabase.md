\# Supabase - Padrões Gerais



\## Objetivo



Este documento define padrões gerais para utilização do Supabase em qualquer projeto.



O Cursor Agent deve consultar este arquivo antes de criar, alterar ou integrar funcionalidades que utilizem recursos do Supabase.



Este documento não define:



\- tabelas específicas;

\- regras de negócio;

\- estrutura de clientes;

\- campos obrigatórios;

\- modelos de dados de projetos específicos.



Cada projeto deve possuir sua própria documentação de estrutura de dados.



\---



\# Análise Antes da Implementação



Antes de criar ou alterar recursos no Supabase:



O Cursor Agent deve:



1\. analisar a estrutura existente;

2\. verificar tabelas disponíveis;

3\. identificar relacionamentos;

4\. entender regras atuais;

5\. avaliar impacto das alterações.



Nunca criar estruturas duplicadas sem análise prévia.



\---



\# Recursos do Supabase



O Supabase pode fornecer recursos como:



\- PostgreSQL;

\- Authentication;

\- Storage;

\- Edge Functions;

\- Realtime;

\- APIs automáticas.



Antes de utilizar qualquer recurso:



Avaliar:



\- necessidade real;

\- impacto na arquitetura;

\- segurança;

\- manutenção futura.



\---



\# Banco de Dados



O Supabase utiliza PostgreSQL como banco principal.



Alterações estruturais devem considerar:



\- criação de tabelas;

\- alteração de colunas;

\- índices;

\- relacionamentos;

\- constraints;

\- permissões;

\- migrations.



Nunca alterar estruturas importantes sem documentação.



\---



\# Modelagem de Dados



Antes de criar novas estruturas:



Avaliar:



\- existência de dados semelhantes;

\- normalização;

\- relacionamentos;

\- crescimento futuro;

\- impacto no sistema.



Priorizar:



\- organização;

\- consistência;

\- clareza;

\- manutenção simples.



\---



\# Padrões de Nomenclatura



Utilizar padrões consistentes.



Preferir:



\- nomes em letras minúsculas;

\- palavras separadas por underscore;

\- nomes descritivos;

\- padronização entre tabelas e campos.



Exemplo:



```text

usuarios

clientes\_ativos

created\_at

updated\_at

Evitar:



nomes genéricos;

abreviações confusas;

mistura de idiomas.

Segurança e RLS



O Row Level Security (RLS) deve ser considerado sempre que houver dados privados.



Avaliar:



quem pode consultar;

quem pode inserir;

quem pode atualizar;

quem pode excluir.



Nunca deixar dados sensíveis acessíveis sem controle adequado.



Authentication



Ao utilizar autenticação:



Considerar:



fluxo de cadastro;

login;

recuperação de acesso;

permissões;

associação com dados internos.



Nunca confiar apenas no frontend para controle de acesso.



Storage



Ao utilizar armazenamento de arquivos:



Avaliar:



permissões;

tamanho dos arquivos;

organização;

segurança;

necessidade de exclusão.



Evitar arquivos sensíveis com acesso público sem necessidade.



APIs e Integrações



Ao consumir dados do Supabase:



Considerar:



validação das respostas;

tratamento de erros;

controle de permissões;

desempenho das consultas.



Nunca expor credenciais administrativas no frontend.



Performance



Antes de criar consultas:



Avaliar:



quantidade de dados;

necessidade de índices;

complexidade das consultas;

frequência de utilização.



Evitar consultas pesadas sem otimização.



Migrations



Alterações estruturais devem ser controladas através de migrations.



Considerar:



histórico das alterações;

possibilidade de rollback;

ambiente de execução;

impacto nos dados existentes.



Evitar alterações manuais sem registro.



Backup e Recuperação



Projetos importantes devem considerar:



backup dos dados;

estratégia de recuperação;

validação dos backups.



Dados críticos nunca devem depender de uma única cópia.



Ambientes



Quando aplicável, separar:



desenvolvimento;

homologação;

produção.



Evitar testar alterações diretamente em ambiente produtivo.



Logs e Diagnóstico



Ao investigar problemas:



Analisar:



erros retornados;

consultas executadas;

permissões;

alterações recentes;

logs disponíveis.



Evitar alterações sem diagnóstico.



Alterações em Projetos Existentes



Antes de modificar um banco Supabase existente:



O Cursor Agent deve:



entender a estrutura atual;

identificar dependências;

avaliar impacto;

criar plano de alteração;

validar após implementação.

Regra Final



O Cursor Agent nunca deve assumir:



estrutura das tabelas;

regras de negócio;

permissões existentes;

dados disponíveis;

arquitetura do banco.



Sempre deve analisar o projeto atual antes de criar ou modificar qualquer recurso no Supabase.



O objetivo é manter:



segurança;

organização;

escalabilidade;

facilidade de manutenção.





