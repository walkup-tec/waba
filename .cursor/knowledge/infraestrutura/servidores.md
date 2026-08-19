\# Servidores - Padrões Gerais



\## Objetivo



Este documento define boas práticas gerais para administração e utilização de servidores em qualquer projeto.



O Cursor Agent deve utilizar estas orientações como referência ao analisar, configurar, diagnosticar ou modificar ambientes de servidores.



O agente nunca deve assumir:



\- provedor de hospedagem;

\- sistema operacional;

\- recursos disponíveis;

\- arquitetura existente;

\- configurações de segurança.



Sempre analisar o ambiente atual antes de realizar alterações.



\---



\# Análise Antes da Implementação



Antes de modificar um servidor:



O Cursor Agent deve:



1\. identificar o ambiente atual;

2\. verificar serviços executados;

3\. analisar recursos disponíveis;

4\. entender dependências;

5\. avaliar impactos.



Nunca realizar alterações críticas sem compreender o cenário.



\---



\# Características do Servidor



Avaliar:



\- CPU;

\- memória RAM;

\- armazenamento;

\- sistema operacional;

\- rede;

\- limitações do ambiente.



As soluções devem considerar os recursos disponíveis.



\---



\# Organização de Serviços



Manter serviços organizados.



Considerar:



\- identificação clara;

\- separação de responsabilidades;

\- documentação;

\- facilidade de manutenção.



Evitar instalações sem controle ou documentação.



\---



\# Sistema Operacional



Antes de executar comandos:



Verificar:



\- sistema utilizado;

\- versão;

\- gerenciador de pacotes;

\- permissões necessárias.



Nunca assumir comandos sem validar o ambiente.



\---



\# Usuários e Permissões



Seguir o princípio de menor privilégio.



Considerar:



\- usuários separados;

\- permissões adequadas;

\- acesso administrativo controlado.



Evitar executar tudo com privilégios elevados sem necessidade.



\---



\# Segurança



Um servidor deve considerar:



\- atualização de componentes;

\- proteção de acessos;

\- firewall;

\- autenticação segura;

\- monitoramento.



Nunca expor serviços administrativos sem proteção.



\---



\# Atualizações



Antes de atualizar componentes:



Avaliar:



\- compatibilidade;

\- impacto;

\- necessidade de backup;

\- possibilidade de rollback.



Evitar atualizações automáticas sem validação.



\---



\# Monitoramento de Recursos



Acompanhar quando aplicável:



\- uso de CPU;

\- memória;

\- armazenamento;

\- processos;

\- rede.



Identificar problemas antes que causem indisponibilidade.



\---



\# Logs



Manter capacidade de diagnóstico.



Avaliar:



\- localização dos logs;

\- retenção;

\- tamanho;

\- erros recorrentes.



Evitar ambientes sem rastreabilidade.



\---



\# Armazenamento



Considerar:



\- espaço disponível;

\- crescimento dos dados;

\- backups;

\- limpeza de arquivos temporários.



Evitar deixar armazenamento chegar ao limite.



\---



\# Backup



Sistemas importantes devem possuir estratégia de backup.



Considerar:



\- frequência;

\- local de armazenamento;

\- restauração;

\- validação dos backups.



Um backup deve ser testado para garantir recuperação.



\---



\# Alta Disponibilidade



Quando necessário avaliar:



\- redundância;

\- recuperação de falhas;

\- distribuição de carga;

\- monitoramento.



Não adicionar complexidade sem necessidade real.



\---



\# Deploy em Servidores



Antes de publicar aplicações:



Validar:



\- recursos disponíveis;

\- dependências;

\- portas;

\- variáveis;

\- persistência dos dados.



O ambiente deve estar preparado para receber a aplicação.



\---



\# Diagnóstico de Problemas



Antes de realizar alterações:



Analisar:



\- logs;

\- consumo de recursos;

\- serviços ativos;

\- conectividade;

\- alterações recentes.



Evitar reinicializações ou mudanças sem diagnóstico.



\---



\# Alterações em Produção



Antes de alterar servidores em produção:



O Cursor Agent deve:



1\. identificar impacto;

2\. avaliar riscos;

3\. realizar backup quando necessário;

4\. aplicar mudanças controladas;

5\. validar funcionamento.



\---



\# Regra Final



O Cursor Agent nunca deve assumir:



\- configuração do servidor;

\- sistema operacional;

\- recursos disponíveis;

\- serviços instalados;

\- regras de segurança.



Sempre deve analisar o ambiente atual antes de realizar qualquer alteração.



O objetivo é manter servidores:



\- seguros;

\- estáveis;

\- organizados;

\- fáceis de manter.

