\# WhatsApp - Padrões Gerais



\## Objetivo



Este documento define boas práticas gerais para utilização de integrações com WhatsApp em qualquer projeto.



O Cursor Agent deve utilizar estas orientações como referência ao criar, modificar ou analisar funcionalidades relacionadas a:



\- envio de mensagens;

\- recebimento de mensagens;

\- automações;

\- atendimento;

\- notificações;

\- integrações com APIs.



O agente nunca deve assumir:



\- provedor utilizado;

\- biblioteca;

\- API específica;

\- número conectado;

\- regras de negócio.



Sempre analisar o projeto atual antes de implementar alterações.



\---



\# Análise Antes da Implementação



Antes de criar ou modificar funcionalidades relacionadas ao WhatsApp:



O Cursor Agent deve:



1\. identificar a solução utilizada;

2\. verificar integrações existentes;

3\. entender o fluxo atual;

4\. analisar regras de negócio;

5\. evitar criar fluxos paralelos.



\---



\# Arquitetura de Integração



Uma integração WhatsApp deve possuir responsabilidades claras.



Separar quando aplicável:



\- recebimento de eventos;

\- processamento de mensagens;

\- regras de negócio;

\- envio de respostas;

\- armazenamento de histórico.



Evitar concentrar toda lógica em um único arquivo ou serviço.



\---



\# Envio de Mensagens



Antes de implementar envio:



Avaliar:



\- destinatário;

\- validação do número;

\- formato da mensagem;

\- limites de envio;

\- tratamento de falhas.



Considerar:



\- mensagens duplicadas;

\- falhas temporárias;

\- indisponibilidade do serviço.



\---



\# Recebimento de Mensagens



Ao receber mensagens:



Considerar:



\- validação da origem;

\- processamento correto dos eventos;

\- armazenamento quando necessário;

\- resposta adequada.



Evitar confiar cegamente em dados recebidos externamente.



\---



\# Webhooks



Quando utilizar webhooks:



Implementar:



\- validação da requisição;

\- tratamento de eventos duplicados;

\- respostas rápidas;

\- processamento assíncrono quando necessário.



O sistema deve ser preparado para:



\- atrasos;

\- reenvios;

\- falhas temporárias.



\---



\# Sessões e Conversas



Ao trabalhar com conversas:



Considerar:



\- identificação do usuário;

\- histórico;

\- contexto da conversa;

\- encerramento de sessões.



Evitar perder contexto durante interações.



\---



\# Filas e Processamento



Para grandes volumes:



Avaliar utilização de:



\- filas;

\- processamento assíncrono;

\- controle de concorrência;

\- retentativas.



Evitar bloquear o sistema aguardando respostas externas.



\---



\# Automações



Antes de criar automações:



Avaliar:



\- objetivo;

\- frequência;

\- regras envolvidas;

\- impacto no usuário.



Evitar automações sem controle ou monitoramento.



\---



\# Templates e Mensagens Padronizadas



Quando utilizar mensagens padronizadas:



Considerar:



\- aprovação quando exigida;

\- consistência;

\- clareza;

\- experiência do usuário.



Evitar mensagens confusas ou sem contexto.



\---



\# Armazenamento de Dados



Ao armazenar informações de conversas:



Avaliar:



\- necessidade real;

\- privacidade;

\- segurança;

\- retenção dos dados.



Evitar armazenar informações desnecessárias.



\---



\# Segurança e Privacidade



Considerar:



\- proteção de dados;

\- controle de acesso;

\- autenticação;

\- exposição mínima de informações.



Nunca armazenar:



\- tokens;

\- credenciais;

\- informações sensíveis sem proteção.



\---



\# Logs



Registrar informações úteis para diagnóstico.



Considerar:



\- eventos recebidos;

\- mensagens enviadas;

\- erros;

\- identificadores de operação.



Evitar registrar dados sensíveis desnecessários.



\---



\# Controle de Erros



Toda integração deve tratar falhas.



Considerar:



\- número inválido;

\- serviço indisponível;

\- timeout;

\- falha de autenticação;

\- erro de processamento.



Nunca ignorar erros silenciosamente.



\---



\# Performance



Avaliar:



\- quantidade de mensagens;

\- tempo de processamento;

\- uso de filas;

\- consumo de recursos.



Evitar arquiteturas que não suportem crescimento futuro.



\---



\# Integração com Outros Sistemas



Ao integrar WhatsApp com outros sistemas:



Avaliar:



\- origem dos dados;

\- sincronização;

\- responsabilidades;

\- tratamento de falhas.



Evitar acoplamento desnecessário.



\---



\# Alterações em Projetos Existentes



Antes de modificar integrações WhatsApp:



O Cursor Agent deve:



1\. entender o fluxo atual;

2\. identificar componentes envolvidos;

3\. avaliar impactos;

4\. realizar alterações mínimas;

5\. validar funcionamento.



\---



\# Regra Final



O Cursor Agent nunca deve assumir:



\- API utilizada;

\- provedor WhatsApp;

\- regras de envio;

\- estrutura de atendimento;

\- números conectados.



Sempre deve analisar o projeto atual antes de criar ou modificar funcionalidades WhatsApp.



O objetivo é manter:



\- comunicação confiável;

\- segurança;

\- escalabilidade;

\- facilidade de manutenção.

