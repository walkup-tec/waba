\# Meta APIs - Padrões Gerais



\## Objetivo



Este documento define boas práticas gerais para utilização das APIs da Meta em qualquer projeto.



O Cursor Agent deve utilizar estas orientações como referência ao criar, configurar ou modificar integrações envolvendo:



\- Facebook;

\- Instagram;

\- WhatsApp Business Platform;

\- Meta Graph API;

\- Webhooks;

\- autenticação e permissões.



O agente nunca deve assumir:



\- IDs de aplicativos;

\- contas comerciais;

\- permissões disponíveis;

\- tokens existentes;

\- estrutura da integração.



Sempre analisar o projeto atual antes de realizar alterações.



\---



\# Análise Antes da Implementação



Antes de criar ou modificar integrações com Meta:



O Cursor Agent deve:



1\. identificar qual produto da Meta está sendo utilizado;

2\. verificar APIs disponíveis;

3\. analisar autenticação existente;

4\. verificar permissões necessárias;

5\. entender o fluxo atual.



Evitar criar integrações duplicadas.



\---



\# Autenticação



Integrações com Meta devem utilizar mecanismos seguros de autenticação.



Nunca armazenar diretamente:



\- access tokens;

\- app secrets;

\- chaves privadas;

\- credenciais.



Utilizar:



\- variáveis de ambiente;

\- secrets;

\- configurações protegidas.



\---



\# Tokens de Acesso



Antes de utilizar tokens:



Validar:



\- validade;

\- permissões;

\- escopo necessário;

\- ambiente correto.



Evitar utilizar tokens permanentes sem controle adequado.



\---



\# Permissões



Antes de solicitar ou utilizar permissões:



Avaliar:



\- necessidade real;

\- menor privilégio possível;

\- impacto no aplicativo.



Não solicitar permissões desnecessárias.



\---



\# Meta Graph API



Ao consumir APIs da Meta:



Considerar:



\- versão utilizada;

\- endpoints disponíveis;

\- limites de requisição;

\- formato das respostas.



Nunca assumir que endpoints antigos continuam disponíveis.



\---



\# Webhooks



Ao implementar webhooks:



Considerar:



\- validação da origem;

\- confirmação de recebimento;

\- processamento dos eventos;

\- tratamento de duplicidade.



O sistema deve suportar:



\- eventos repetidos;

\- atrasos;

\- falhas temporárias.



\---



\# WhatsApp Business Platform



Ao integrar WhatsApp Business:



Avaliar:



\- número conectado;

\- conta empresarial;

\- templates aprovados;

\- limites de envio;

\- regras da plataforma.



Evitar automações que desrespeitem políticas da plataforma.



\---



\# Instagram e Facebook



Ao integrar recursos de Instagram ou Facebook:



Verificar:



\- página vinculada;

\- conta comercial;

\- permissões;

\- eventos disponíveis.



Não assumir que todas as contas possuem os mesmos recursos.



\---



\# Tratamento de Erros



Toda integração deve possuir tratamento adequado.



Considerar:



\- token expirado;

\- permissão negada;

\- limite de requisições;

\- resposta inválida;

\- indisponibilidade temporária.



Nunca ignorar respostas de erro.



\---



\# Logs e Auditoria



Registrar informações necessárias para diagnóstico.



Considerar:



\- requisição realizada;

\- resposta recebida;

\- horário;

\- identificadores;

\- erros encontrados.



Evitar armazenar informações sensíveis desnecessárias.



\---



\# Limites de Uso



Antes de implementar automações:



Avaliar:



\- volume de requisições;

\- limites da API;

\- tempo de processamento;

\- necessidade de filas.



Evitar chamadas excessivas sem controle.



\---



\# Segurança



Considerar:



\- proteção de tokens;

\- validação de chamadas externas;

\- controle de acesso;

\- armazenamento seguro de dados.



Nunca expor credenciais no frontend ou código público.



\---



\# Integração com Sistemas Internos



Ao conectar Meta com outros sistemas:



Avaliar:



\- origem dos dados;

\- sincronização;

\- tratamento de falhas;

\- responsabilidade de cada sistema.



Evitar dependência excessiva entre plataformas.



\---



\# Alterações em Projetos Existentes



Antes de modificar integrações Meta:



O Cursor Agent deve:



1\. entender o fluxo atual;

2\. identificar contas e serviços envolvidos;

3\. avaliar impactos;

4\. alterar somente o necessário;

5\. validar funcionamento.



\---



\# Regra Final



O Cursor Agent nunca deve assumir:



\- contas Meta existentes;

\- tokens;

\- permissões;

\- IDs;

\- configurações de aplicativos.



Sempre deve analisar a integração atual antes de criar ou modificar qualquer recurso da Meta.



O objetivo é manter:



\- segurança;

\- compatibilidade;

\- estabilidade;

\- facilidade de manutenção.

