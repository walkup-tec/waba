\# Traefik - Padrões Gerais



\## Objetivo



Este documento define boas práticas gerais para utilização do Traefik em qualquer projeto.



O Cursor Agent deve utilizar estas orientações como referência ao configurar, analisar ou modificar roteamento, proxy reverso, certificados e exposição de serviços.



O agente nunca deve assumir:



\- versão do Traefik;

\- estrutura de configuração;

\- ambiente de execução;

\- serviços existentes;

\- regras de roteamento.



Sempre analisar o ambiente atual antes de realizar alterações.



\---



\# Análise Antes da Implementação



Antes de alterar configurações do Traefik:



O Cursor Agent deve:



1\. identificar a versão utilizada;

2\. analisar arquivos de configuração;

3\. verificar serviços conectados;

4\. entender regras de roteamento existentes;

5\. avaliar impacto das alterações.



Nunca alterar configurações críticas sem compreender o ambiente.



\---



\# Proxy Reverso



O Traefik deve ser utilizado como camada de entrada para serviços quando aplicável.



Avaliar:



\- domínios;

\- portas;

\- serviços internos;

\- regras de encaminhamento.



Evitar criar rotas duplicadas ou conflitantes.



\---



\# Roteamento



Antes de criar uma nova rota:



Verificar:



\- se o domínio já existe;

\- se existe serviço semelhante;

\- se há conflito de regras;

\- se o destino está correto.



Manter regras organizadas e fáceis de identificar.



\---



\# Domínios



Ao configurar novos domínios:



Validar:



\- DNS;

\- apontamento correto;

\- serviço de destino;

\- certificados;

\- disponibilidade.



Nunca assumir que um domínio está configurado corretamente.



\---



\# HTTPS e Certificados



Sempre priorizar comunicação segura.



Considerar:



\- certificados válidos;

\- renovação automática quando disponível;

\- configuração correta de TLS.



Evitar disponibilizar serviços sensíveis sem HTTPS.



\---



\# Middlewares



Antes de criar ou modificar middlewares:



Avaliar impacto.



Exemplos:



\- autenticação;

\- redirecionamentos;

\- headers;

\- compressão;

\- limites de acesso.



Alterações em middlewares podem afetar múltiplos serviços.



\---



\# Segurança



Considerar:



\- exposição mínima de serviços;

\- regras de acesso;

\- proteção administrativa;

\- headers de segurança.



Evitar expor dashboards ou serviços internos sem proteção adequada.



\---



\# Performance



Avaliar:



\- quantidade de rotas;

\- número de conexões;

\- consumo de recursos;

\- logs excessivos.



Evitar configurações que aumentem consumo sem necessidade.



\---



\# Logs e Diagnóstico



Antes de corrigir problemas:



Analisar:



\- logs do Traefik;

\- status dos serviços;

\- erros HTTP;

\- regras carregadas;

\- certificados.



Evitar alterações baseadas apenas em tentativa e erro.



\---



\# Integração com Containers



Quando utilizado com Docker:



Avaliar:



\- labels existentes;

\- redes utilizadas;

\- serviços descobertos;

\- permissões necessárias.



Evitar alterar labels sem entender o impacto.



\---



\# Alterações em Produção



Antes de modificar Traefik em produção:



O Cursor Agent deve:



1\. identificar serviços impactados;

2\. avaliar riscos;

3\. realizar backup quando aplicável;

4\. aplicar mudanças pequenas;

5\. validar funcionamento.



\---



\# Problemas Comuns



Investigar corretamente situações como:



\## 404



Verificar:



\- regra de roteamento;

\- domínio;

\- serviço configurado;

\- middleware.



\## 502



Verificar:



\- serviço de destino;

\- porta interna;

\- container ativo;

\- comunicação entre serviços.



\## Certificado inválido



Verificar:



\- DNS;

\- ACME;

\- configuração TLS;

\- renovação.



\---



\# Regra Final



O Cursor Agent nunca deve assumir:



\- configuração do Traefik;

\- domínios;

\- regras de proxy;

\- certificados;

\- estrutura Docker.



Sempre deve analisar a configuração existente antes de realizar alterações.



O objetivo é manter:



\- estabilidade;

\- segurança;

\- disponibilidade;

\- facilidade de manutenção.

