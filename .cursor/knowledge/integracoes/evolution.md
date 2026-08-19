\# Evolution API - Padrões Gerais



\## Objetivo



Este documento define boas práticas gerais para utilização da Evolution API em qualquer projeto.



O Cursor Agent deve utilizar estas orientações como referência ao criar, integrar, configurar ou modificar funcionalidades relacionadas à Evolution API e comunicação via WhatsApp.



O agente nunca deve assumir:



\- versão da API;

\- estrutura de endpoints;

\- provedor de hospedagem;

\- configuração de instâncias;

\- regras de autenticação;

\- fluxo de mensagens.



Sempre analisar a implementação existente antes de realizar alterações.



\---



\# Análise Antes da Implementação



Antes de criar ou modificar integrações com Evolution API:



O Cursor Agent deve:



1\. identificar a versão utilizada;

2\. analisar endpoints existentes;

3\. verificar autenticação configurada;

4\. entender fluxo atual de mensagens;

5\. identificar dependências existentes.



Evitar criar integrações paralelas sem necessidade.



\---



\# Instâncias WhatsApp



Antes de manipular instâncias:



Avaliar:



\- identificação da instância;

\- status atual;

\- conexão;

\- configurações existentes;

\- dependências.



Nunca assumir que uma instância está disponível ou conectada.



\---



\# Autenticação



A autenticação deve ser tratada de forma segura.



Nunca armazenar diretamente:



\- tokens;

\- chaves de API;

\- credenciais.



Utilizar:



\- variáveis de ambiente;

\- secrets;

\- mecanismos seguros de configuração.



\---



\# Envio de Mensagens



Antes de implementar envio de mensagens:



Avaliar:



\- formato esperado;

\- validação do destinatário;

\- tratamento de erros;

\- limites de envio;

\- controle de repetição.



Evitar disparos sem controle ou validação.



\---



\# Recebimento de Mensagens



Ao implementar recebimento:



Considerar:



\- webhooks;

\- validação da origem;

\- processamento assíncrono;

\- tratamento de falhas.



Evitar depender apenas de processos síncronos quando houver grande volume.



\---



\# Webhooks



Antes de configurar webhooks:



Validar:



\- URL de destino;

\- autenticação;

\- eventos necessários;

\- tratamento de respostas.



O sistema deve conseguir lidar com:



\- eventos duplicados;

\- atrasos;

\- falhas temporárias.



\---



\# Filas e Processamento



Quando houver grande volume de mensagens:



Avaliar utilização de:



\- filas;

\- processamento assíncrono;

\- controle de concorrência;

\- retentativas.



Evitar sobrecarregar a API com chamadas simultâneas sem controle.



\---



\# Controle de Erros



Toda integração deve tratar falhas.



Considerar:



\- API indisponível;

\- timeout;

\- respostas inválidas;

\- instância desconectada;

\- falha de autenticação.



Nunca ignorar erros silenciosamente.



\---



\# Logs



Registrar informações importantes para diagnóstico.



Considerar:



\- envio realizado;

\- resposta da API;

\- erros;

\- identificadores de mensagem;

\- eventos recebidos.



Evitar armazenar dados sensíveis desnecessários.



\---



\# Segurança



Considerar:



\- proteção de tokens;

\- validação de requisições;

\- controle de acesso;

\- exposição mínima de endpoints.



Nunca deixar endpoints administrativos sem proteção.



\---



\# Limites e Boas Práticas



Antes de realizar disparos:



Avaliar:



\- quantidade de mensagens;

\- intervalo entre envios;

\- regras do provedor;

\- comportamento esperado.



Evitar automações que possam gerar bloqueios ou instabilidade.



\---



\# Integração com Outros Sistemas



Ao integrar Evolution API com outros serviços:



Avaliar:



\- contratos de comunicação;

\- tratamento de falhas;

\- sincronização de dados;

\- responsabilidade de cada sistema.



Evitar acoplamento excessivo.



\---



\# Alterações em Projetos Existentes



Antes de modificar uma integração existente:



O Cursor Agent deve:



1\. entender o fluxo atual;

2\. identificar sistemas envolvidos;

3\. avaliar impactos;

4\. realizar alterações mínimas;

5\. validar funcionamento.



\---



\# Regra Final



O Cursor Agent nunca deve assumir:



\- configuração da Evolution API;

\- endpoints;

\- instâncias existentes;

\- tokens;

\- regras de envio.



Sempre deve analisar o projeto atual antes de criar ou modificar integrações.



O objetivo é manter:



\- comunicação confiável;

\- segurança;

\- rastreabilidade;

\- facilidade de manutenção.

