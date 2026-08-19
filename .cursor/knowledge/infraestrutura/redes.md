\# Redes - Padrões Gerais



\## Objetivo



Este documento define boas práticas gerais relacionadas à configuração e utilização de redes em ambientes de software.



O Cursor Agent deve utilizar estas orientações como referência ao analisar, criar ou modificar configurações de rede.



O agente nunca deve assumir:



\- arquitetura de rede;

\- provedor utilizado;

\- endereços IP;

\- regras de firewall;

\- topologia existente.



Sempre analisar o ambiente atual antes de realizar alterações.



\---



\# Análise Antes da Implementação



Antes de modificar configurações de rede:



O Cursor Agent deve:



1\. identificar os serviços envolvidos;

2\. entender a comunicação necessária;

3\. verificar configurações existentes;

4\. analisar impactos;

5\. evitar alterações desnecessárias.



\---



\# Princípios de Rede



Uma arquitetura de rede deve priorizar:



\- segurança;

\- isolamento;

\- disponibilidade;

\- organização;

\- facilidade de manutenção.



Evitar exposições desnecessárias.



\---



\# Comunicação Entre Serviços



Ao configurar comunicação entre aplicações:



Avaliar:



\- origem da conexão;

\- destino;

\- portas necessárias;

\- autenticação;

\- necessidade real de acesso.



Liberar somente o necessário.



\---



\# Portas



Antes de abrir uma porta:



Verificar:



\- qual serviço utiliza;

\- necessidade de exposição;

\- risco envolvido;

\- conflito existente.



Evitar expor serviços internos diretamente à internet.



\---



\# Endereçamento



Manter organização de:



\- IPs;

\- domínios;

\- hosts;

\- serviços.



Evitar configurações espalhadas ou sem documentação.



\---



\# DNS



Antes de alterar registros DNS:



Validar:



\- serviço de destino;

\- propagação esperada;

\- impacto em usuários;

\- dependências existentes.



Alterações de DNS podem afetar múltiplos sistemas.



\---



\# Firewall



Regras de firewall devem seguir o princípio:



"permitir somente o necessário".



Avaliar:



\- origem;

\- destino;

\- porta;

\- protocolo;

\- finalidade.



Evitar regras amplas sem necessidade.



\---



\# Ambientes Containerizados



Quando utilizar containers:



Considerar:



\- redes internas;

\- comunicação entre serviços;

\- isolamento;

\- exposição externa.



Evitar publicar serviços internos sem necessidade.



\---



\# Segurança



Considerar:



\- criptografia de comunicação;

\- autenticação;

\- restrição de acesso;

\- monitoramento.



Nunca assumir que uma rede interna é automaticamente segura.



\---



\# Diagnóstico de Problemas



Antes de alterar configurações para corrigir problemas:



Analisar:



\- conectividade;

\- DNS;

\- portas;

\- firewall;

\- logs;

\- serviços envolvidos.



Evitar alterações por tentativa e erro.



\---



\# Performance



Avaliar:



\- latência;

\- quantidade de conexões;

\- consumo de banda;

\- gargalos de comunicação.



Otimizar somente quando existir necessidade identificada.



\---



\# Monitoramento



Quando aplicável, acompanhar:



\- disponibilidade;

\- erros de conexão;

\- consumo;

\- falhas recorrentes.



Ter visibilidade facilita diagnóstico.



\---



\# Alterações em Ambientes Existentes



Antes de modificar redes:



O Cursor Agent deve:



1\. identificar componentes afetados;

2\. avaliar impactos;

3\. preservar configurações existentes;

4\. realizar alterações pequenas;

5\. validar funcionamento.



\---



\# Regra Final



O Cursor Agent nunca deve assumir:



\- configuração de rede;

\- regras de firewall;

\- portas utilizadas;

\- arquitetura existente.



Sempre deve analisar o ambiente atual antes de alterar configurações de rede.



O objetivo é manter:



\- segurança;

\- estabilidade;

\- organização;

\- previsibilidade.

