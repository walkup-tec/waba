\# EasyPanel - Padrões Gerais



\## Objetivo



Este documento define boas práticas gerais para utilização do EasyPanel em qualquer projeto.



O Cursor Agent deve utilizar estas orientações como referência ao configurar, publicar, atualizar ou diagnosticar aplicações utilizando EasyPanel.



O agente nunca deve assumir:



\- estrutura do servidor;

\- aplicações existentes;

\- configurações de proxy;

\- domínios;

\- serviços instalados.



Sempre analisar o ambiente atual antes de realizar alterações.



\---



\# Análise Antes da Implementação



Antes de criar ou modificar uma aplicação no EasyPanel:



O Cursor Agent deve:



1\. analisar serviços existentes;

2\. identificar recursos utilizados;

3\. verificar configurações atuais;

4\. entender dependências;

5\. evitar alterações que possam impactar aplicações existentes.



\---



\# Organização de Projetos



Cada aplicação deve possuir:



\- identificação clara;

\- configuração documentada;

\- variáveis organizadas;

\- serviços separados quando necessário.



Evitar configurações sem documentação.



\---



\# Deploy de Aplicações



Antes de realizar um deploy:



Validar:



\- código atualizado;

\- dependências corretas;

\- variáveis de ambiente;

\- portas necessárias;

\- persistência dos dados.



O deploy deve ser previsível e reproduzível.



\---



\# Variáveis de Ambiente



Nunca armazenar diretamente:



\- senhas;

\- tokens;

\- chaves;

\- credenciais.



Utilizar:



\- variáveis protegidas;

\- secrets;

\- configurações específicas por ambiente.



Separar configurações de:



\- desenvolvimento;

\- homologação;

\- produção.



\---



\# Domínios e Proxy



Antes de configurar domínios:



Avaliar:



\- serviço correto;

\- portas utilizadas;

\- certificados;

\- roteamento.



Evitar alterações de proxy sem entender o impacto nos serviços existentes.



\---



\# Containers e Serviços



O EasyPanel normalmente trabalha com aplicações containerizadas.



Ao criar serviços:



Avaliar:



\- responsabilidade do serviço;

\- dependências;

\- persistência;

\- comunicação entre containers.



Evitar concentrar serviços independentes sem necessidade.



\---



\# Banco de Dados



Ao utilizar bancos através do EasyPanel:



Considerar:



\- persistência através de volumes;

\- backups;

\- credenciais seguras;

\- acesso restrito.



Nunca remover volumes sem confirmar impacto nos dados.



\---



\# Logs e Diagnóstico



Antes de alterar uma aplicação com problema:



Analisar:



\- logs da aplicação;

\- status do container;

\- consumo de recursos;

\- erros de inicialização.



Evitar alterações baseadas apenas em tentativa e erro.



\---



\# Atualizações



Antes de atualizar serviços:



Avaliar:



\- versão atual;

\- compatibilidade;

\- possíveis impactos;

\- necessidade de backup.



Evitar atualizações automáticas sem validação.



\---



\# Recursos do Servidor



Monitorar:



\- CPU;

\- memória;

\- armazenamento;

\- rede;

\- quantidade de serviços ativos.



Aplicações devem possuir consumo compatível com o ambiente disponível.



\---



\# Segurança



Considerar:



\- acesso administrativo protegido;

\- senhas fortes;

\- exposição mínima de serviços;

\- atualização de componentes.



Nunca expor serviços internos sem necessidade.



\---



\# Backup e Recuperação



Projetos importantes devem possuir estratégia de:



\- backup;

\- restauração;

\- testes de recuperação.



Um backup não testado não garante recuperação.



\---



\# Alterações em Ambientes Existentes



Antes de modificar configurações no EasyPanel:



O Cursor Agent deve:



1\. identificar serviços afetados;

2\. avaliar dependências;

3\. preservar configurações existentes;

4\. realizar alterações mínimas;

5\. validar após alteração.



\---



\# Regra Final



O Cursor Agent nunca deve assumir:



\- estrutura do EasyPanel;

\- aplicações existentes;

\- configurações de servidor;

\- regras de deploy.



Sempre deve analisar o ambiente atual antes de criar, alterar ou remover recursos no EasyPanel.



---

# Build e artefatos (imagem que só copia dist/)

Alguns serviços EasyPanel usam Dockerfile que apenas copia a pasta dist/ (ou equivalente) e **não** executam 
pm run build / compilação dentro da imagem.

Nesses casos:

- alterar só o código-fonte (src/, index.html da raiz) **não** atualiza a aplicação publicada;
- antes do push/Redeploy: gerar o artefato localmente (
pm run build ou equivalente) e **commitar** dist/ (ou o diretório copiado pelo Dockerfile);
- validar pós-deploy com hard refresh e health/marker quando existir.

Esta regra é reutilizável em qualquer projeto com o mesmo padrão de Dockerfile.

