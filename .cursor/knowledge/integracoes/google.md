\# Google APIs - Padrões Gerais



\## Objetivo



Este documento define boas práticas gerais para utilização das APIs e serviços Google em qualquer projeto.



O Cursor Agent deve utilizar estas orientações como referência ao criar, configurar ou modificar integrações envolvendo:



\- Google OAuth;

\- Google Calendar API;

\- Google Sheets API;

\- Google Drive API;

\- Google Gmail API;

\- Google Cloud APIs;

\- serviços relacionados.



O agente nunca deve assumir:



\- conta Google utilizada;

\- projeto Google Cloud;

\- credenciais existentes;

\- APIs habilitadas;

\- permissões disponíveis.



Sempre analisar o projeto atual antes de realizar alterações.



\---



\# Análise Antes da Implementação



Antes de criar ou modificar integrações Google:



O Cursor Agent deve:



1\. identificar qual serviço Google será utilizado;

2\. verificar APIs habilitadas;

3\. analisar autenticação existente;

4\. validar permissões necessárias;

5\. entender o fluxo atual.



Evitar criar configurações duplicadas.



\---



\# Google Cloud Project



Antes de utilizar APIs Google:



Verificar:



\- projeto Google Cloud correto;

\- APIs habilitadas;

\- credenciais configuradas;

\- limites de utilização;

\- permissões de acesso.



Nunca assumir que uma API está disponível.



\---



\# Autenticação OAuth



Integrações Google normalmente utilizam OAuth.



Considerar:



\- fluxo correto de autenticação;

\- renovação de tokens;

\- permissões solicitadas;

\- armazenamento seguro.



Nunca armazenar diretamente:



\- client secrets;

\- access tokens;

\- refresh tokens.



Utilizar:



\- variáveis de ambiente;

\- secrets;

\- armazenamento protegido.



\---



\# Permissões



Solicitar somente as permissões necessárias.



Avaliar:



\- menor privilégio possível;

\- impacto ao usuário;

\- finalidade de cada permissão.



Evitar permissões amplas sem necessidade.



\---



\# Google Calendar



Ao integrar calendário:



Considerar:



\- identificação do calendário correto;

\- timezone;

\- criação e atualização de eventos;

\- conflitos de agenda;

\- permissões.



Sempre validar datas e horários antes de criar eventos.



\---



\# Google Sheets



Ao utilizar Google Sheets:



Considerar:



\- estrutura da planilha;

\- nomes das colunas;

\- permissões;

\- limites da API;

\- consistência dos dados.



Evitar depender de posições fixas sem validação.



\---



\# Google Drive



Ao utilizar Google Drive:



Avaliar:



\- permissões de arquivos;

\- organização de pastas;

\- compartilhamentos;

\- armazenamento.



Evitar deixar arquivos sensíveis com acesso público.



\---



\# Gmail API



Quando integrar Gmail:



Considerar:



\- permissões de leitura/envio;

\- segurança dos dados;

\- filtros;

\- histórico.



Evitar armazenar mensagens completas sem necessidade.



\---



\# Tratamento de Erros



Toda integração Google deve tratar falhas.



Considerar:



\- token expirado;

\- permissão negada;

\- limite de API;

\- serviço indisponível;

\- resposta inválida.



Nunca ignorar erros silenciosamente.



\---



\# Limites de API



Antes de criar automações:



Avaliar:



\- quantidade de requisições;

\- limites da API;

\- necessidade de cache;

\- processamento em lote.



Evitar chamadas desnecessárias.



\---



\# Processamento Assíncrono



Quando houver grande volume:



Avaliar:



\- filas;

\- processamento em background;

\- controle de tentativas;

\- tratamento de falhas.



Evitar bloquear aplicações aguardando respostas externas.



\---



\# Logs e Auditoria



Registrar informações úteis para diagnóstico.



Considerar:



\- operação realizada;

\- horário;

\- identificadores;

\- erros;

\- status da operação.



Evitar registrar dados sensíveis desnecessários.



\---



\# Segurança



Considerar:



\- proteção de credenciais;

\- controle de acesso;

\- armazenamento seguro;

\- validação das integrações.



Nunca expor credenciais Google no frontend ou repositórios públicos.



\---



\# Integração com Sistemas Internos



Ao conectar serviços Google com sistemas próprios:



Avaliar:



\- sincronização de dados;

\- origem das informações;

\- conflitos;

\- tratamento de falhas.



Evitar duplicação de dados sem controle.



\---



\# Alterações em Projetos Existentes



Antes de modificar integrações Google:



O Cursor Agent deve:



1\. entender o fluxo atual;

2\. identificar APIs utilizadas;

3\. verificar credenciais existentes;

4\. avaliar impactos;

5\. realizar alterações mínimas;

6\. validar funcionamento.



\---



\# Regra Final



O Cursor Agent nunca deve assumir:



\- contas Google;

\- projetos Cloud;

\- credenciais;

\- permissões;

\- APIs habilitadas.



Sempre deve analisar o projeto atual antes de criar ou modificar integrações Google.



O objetivo é manter:



\- segurança;

\- compatibilidade;

\- estabilidade;

\- facilidade de manutenção.

