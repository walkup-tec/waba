\# Supabase - Padrões Gerais



\## Objetivo



Este documento define orientações gerais para utilização do Supabase em qualquer projeto.



O Cursor Agent deve utilizar este arquivo como referência quando trabalhar com projetos que utilizam Supabase, mas nunca deve assumir uma estrutura específica de banco, tabelas ou regras de negócio.



Cada projeto possui sua própria arquitetura e documentação complementar.



\---



\# Princípio Geral



Antes de implementar qualquer funcionalidade utilizando Supabase, o Cursor Agent deve:



1\. analisar a estrutura atual do projeto;

2\. verificar tabelas existentes;

3\. entender os relacionamentos existentes;

4\. identificar padrões já utilizados;

5\. evitar criar soluções paralelas ou conflitantes.



Nunca criar uma estrutura nova sem avaliar se já existe uma solução equivalente.



\---



\# Responsabilidades do Supabase



O Supabase pode ser utilizado para:



\- banco de dados PostgreSQL;

\- autenticação;

\- armazenamento de arquivos;

\- APIs automáticas;

\- funções;

\- realtime;

\- gerenciamento de permissões.



A utilização dos recursos deve seguir a necessidade do projeto.



Evitar adicionar recursos que não tenham uma finalidade clara.



\---



\# Banco de Dados



Quando utilizar o banco PostgreSQL através do Supabase:



Considerar:



\- modelagem adequada;

\- integridade dos dados;

\- relacionamentos;

\- performance;

\- segurança.



Antes de alterar estruturas existentes:



\- identificar impactos;

\- verificar dependências;

\- avaliar dados já armazenados.



\---



\# Criação de Tabelas



Ao criar novas tabelas:



O Cursor Agent deve avaliar:



\- se a entidade realmente precisa existir;

\- se uma tabela existente pode ser reutilizada;

\- se os campos são necessários;

\- se os relacionamentos estão corretos.



Não criar tabelas apenas para facilitar uma implementação temporária.



\---



\# Migrations



Toda alteração estrutural deve ser versionada.



Exemplos:



\- criação de tabelas;

\- alteração de campos;

\- criação de índices;

\- alterações de permissões.



Preferir migrations rastreáveis ao invés de alterações manuais.



\---



\# Segurança



Sempre considerar:



\- Row Level Security (RLS);

\- políticas de acesso;

\- permissões adequadas;

\- proteção de informações sensíveis.



Nunca liberar acesso amplo sem justificativa.



O controle de acesso deve seguir as regras do projeto.



\---



\# Variáveis de Ambiente



Nunca inserir:



\- chaves;

\- tokens;

\- senhas;

\- credenciais;



diretamente no código.



Utilizar:



\- arquivos de ambiente;

\- secrets;

\- variáveis protegidas da plataforma utilizada.



\---



\# Consultas ao Banco



As consultas devem:



\- buscar somente dados necessários;

\- evitar consultas desnecessariamente pesadas;

\- considerar índices quando necessário;

\- respeitar padrões existentes no projeto.



Evitar otimizações sem análise real de impacto.



\---



\# Integração com Aplicação



Separar responsabilidades:



\## Aplicação



Responsável por:



\- regras de negócio;

\- validações;

\- fluxo da aplicação.



\## Banco



Responsável por:



\- persistência;

\- integridade;

\- consultas;

\- relacionamentos.



Evitar concentrar toda regra de negócio dentro do banco sem necessidade.



\---



\# Alterações em Projetos Existentes



Antes de modificar qualquer estrutura Supabase:



O Cursor Agent deve:



1\. identificar arquivos relacionados;

2\. analisar dependências;

3\. verificar impacto;

4\. implementar a menor alteração necessária;

5\. validar funcionamento.



\---



\# Documentação



Quando uma decisão importante for tomada envolvendo Supabase:



Registrar:



\- motivo da decisão;

\- impacto;

\- arquivos alterados;

\- possíveis limitações.



\---



\# Regra Final



O Cursor Agent nunca deve assumir:



\- nomes de tabelas;

\- campos existentes;

\- regras de negócio;

\- arquitetura específica.



Sempre deve analisar o projeto atual antes de implementar.



