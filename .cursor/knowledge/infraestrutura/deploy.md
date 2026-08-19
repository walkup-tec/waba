\# Deploy - Padrões Gerais



\## Objetivo



Este documento define boas práticas gerais para processos de deploy em qualquer projeto.



O Cursor Agent deve utilizar estas orientações como referência ao preparar, executar, analisar ou modificar processos de publicação de aplicações.



O agente nunca deve assumir:



\- plataforma de hospedagem;

\- ambiente de execução;

\- pipeline existente;

\- estratégia de publicação;

\- configuração de infraestrutura.



Sempre analisar o projeto atual antes de realizar alterações.



\---



\# Análise Antes do Deploy



Antes de realizar qualquer deploy:



O Cursor Agent deve:



1\. identificar o ambiente de destino;

2\. verificar a configuração atual;

3\. analisar dependências;

4\. validar variáveis necessárias;

5\. entender o processo existente.



Evitar executar deploy sem compreender o ambiente.



\---



\# Ambientes



Quando aplicável, separar:



\- desenvolvimento;

\- homologação;

\- produção.



Cada ambiente deve possuir configurações adequadas.



Nunca utilizar configurações de produção em ambiente de teste sem validação.



\---



\# Preparação da Aplicação



Antes do deploy:



Validar:



\- código atualizado;

\- dependências instaladas;

\- build funcionando;

\- testes disponíveis executados;

\- configurações necessárias.



A aplicação deve estar em estado funcional antes da publicação.



\---



\# Versionamento



Todo deploy deve possuir rastreabilidade.



Considerar:



\- versão publicada;

\- commit relacionado;

\- data da publicação;

\- alterações realizadas.



Evitar publicar alterações sem histórico.



\---



\# Build



Antes de publicar uma aplicação:



Verificar:



\- processo de build;

\- erros de compilação;

\- dependências;

\- arquivos gerados.



Nunca assumir que uma aplicação irá funcionar em produção apenas porque funciona localmente.



\---



\# Variáveis de Ambiente



Antes da publicação:



Validar:



\- variáveis obrigatórias;

\- valores corretos;

\- permissões;

\- segurança das informações.



Nunca publicar credenciais diretamente no código.



\---



\# Banco de Dados



Quando houver alterações de banco:



Avaliar:



\- migrations necessárias;

\- compatibilidade;

\- backup;

\- ordem de execução.



Evitar alterar estrutura de dados em produção sem planejamento.



\---



\# Migrações



Antes de executar migrations:



Verificar:



\- impacto nos dados existentes;

\- possibilidade de rollback;

\- tempo de execução;

\- dependências.



Alterações críticas devem possuir estratégia de recuperação.



\---



\# Rollback



Todo processo de deploy deve considerar possibilidade de retorno.



Avaliar:



\- versão anterior disponível;

\- backup;

\- reversão de alterações;

\- impacto no usuário.



\---



\# Monitoramento Pós-Deploy



Após publicar:



Validar:



\- aplicação funcionando;

\- logs;

\- erros;

\- disponibilidade;

\- comportamento esperado.



O deploy só deve ser considerado concluído após validação.



\---



\# Logs e Diagnóstico



Em caso de falha:



Analisar:



\- logs da aplicação;

\- logs da infraestrutura;

\- erros de inicialização;

\- alterações recentes.



Evitar alterações aleatórias sem diagnóstico.



\---



\# Segurança



Durante deploy:



Considerar:



\- proteção de informações sensíveis;

\- permissões adequadas;

\- exposição mínima de serviços;

\- atualização segura de componentes.



\---



\# Automação



Quando utilizar automação:



Avaliar:



\- confiabilidade;

\- previsibilidade;

\- tratamento de erros;

\- possibilidade de auditoria.



Automatizar processos repetitivos, mas manter controle sobre alterações críticas.



\---



\# Produção



Deploy em produção deve considerar:



\- impacto nos usuários;

\- disponibilidade;

\- comunicação de alterações;

\- plano de recuperação.



Evitar alterações grandes sem validação prévia.



\---



\# Alterações em Projetos Existentes



Antes de modificar processos de deploy:



O Cursor Agent deve:



1\. entender o fluxo atual;

2\. identificar dependências;

3\. avaliar riscos;

4\. alterar somente o necessário;

5\. validar após publicação.



\---



\# Regra Final



O Cursor Agent nunca deve assumir:



\- processo de deploy;

\- infraestrutura;

\- ambientes;

\- pipelines;

\- configurações existentes.



Sempre deve analisar o cenário atual antes de realizar qualquer publicação.



O objetivo é garantir:



\- segurança;

\- estabilidade;

\- rastreabilidade;

\- facilidade de manutenção.



---

# Artefato commitado vs build no container

Se o pipeline/Dockerfile de produção **não** compila o projeto e apenas copia artefatos pré-gerados (dist/, uild/, etc.):

1. Build local (ou CI) antes do deploy.
2. Incluir os artefatos no commit/branch de produção.
3. Só então Redeploy / push que dispara a publicação.

Caso contrário a UI ou o runtime antigo permanece no container mesmo com o código-fonte novo no Git.

