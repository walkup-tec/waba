\# Docker - Padrões Gerais



\## Objetivo



Este documento define boas práticas gerais para utilização do Docker em qualquer projeto.



O Cursor Agent deve utilizar estas orientações como referência ao criar, configurar, executar ou modificar ambientes Docker.



O agente nunca deve assumir:



\- imagens utilizadas;

\- estrutura de containers;

\- arquivos Docker existentes;

\- ambiente de execução;

\- estratégia de deploy.



Sempre analisar o projeto atual antes de implementar alterações.



\---



\# Análise Antes da Implementação



Antes de criar ou alterar configurações Docker:



O Cursor Agent deve:



1\. analisar arquivos existentes;

2\. identificar serviços utilizados;

3\. verificar padrões de execução;

4\. entender dependências;

5\. evitar substituir configurações existentes sem necessidade.



\---



\# Dockerfile



Um Dockerfile deve priorizar:



\- clareza;

\- segurança;

\- manutenção simples;

\- imagens adequadas.



Boas práticas:



\- utilizar imagens oficiais quando possível;

\- evitar instalar dependências desnecessárias;

\- manter versões definidas quando necessário;

\- reduzir tamanho final da imagem.



\---



\# Imagens



Antes de escolher uma imagem:



Avaliar:



\- origem;

\- manutenção;

\- segurança;

\- compatibilidade;

\- necessidade do projeto.



Evitar utilizar imagens desconhecidas ou sem manutenção.



\---



\# Containers



Cada container deve possuir uma responsabilidade clara.



Evitar:



\- colocar muitos serviços independentes no mesmo container;

\- misturar responsabilidades;

\- criar containers difíceis de manter.



\---



\# Docker Compose



Quando utilizar Docker Compose:



Considerar:



\- organização dos serviços;

\- variáveis de ambiente;

\- volumes;

\- redes;

\- dependências entre serviços.



Manter arquivos organizados e fáceis de entender.



\---



\# Variáveis de Ambiente



Nunca inserir diretamente no código:



\- senhas;

\- tokens;

\- chaves;

\- credenciais.



Utilizar:



\- arquivos `.env`;

\- secrets;

\- variáveis protegidas.



Nunca versionar informações sensíveis.



\---



\# Volumes



Volumes devem ser utilizados quando houver necessidade de persistência.



Avaliar:



\- dados importantes;

\- backups;

\- permissões;

\- ciclo de vida dos dados.



Evitar volumes desnecessários.



\---



\# Redes



Ao criar redes Docker:



Avaliar:



\- comunicação necessária entre serviços;

\- isolamento;

\- segurança.



Evitar expor serviços internamente sem necessidade.



\---



\# Portas



Antes de expor portas:



Avaliar:



\- necessidade externa;

\- conflito com outros serviços;

\- segurança.



Expor somente o necessário.



\---



\# Logs



Os containers devem permitir diagnóstico.



Considerar:



\- logs acessíveis;

\- rotação quando necessário;

\- identificação clara de erros.



Evitar containers sem observabilidade.



\---



\# Segurança



Considerar:



\- imagens atualizadas;

\- menor privilégio possível;

\- exposição mínima de portas;

\- proteção de informações sensíveis.



Evitar executar processos com privilégios elevados sem necessidade.



\---



\# Performance



Avaliar:



\- tamanho das imagens;

\- consumo de memória;

\- uso de CPU;

\- quantidade de containers.



Evitar configurações excessivamente complexas sem necessidade.



\---



\# Desenvolvimento Local



O ambiente local deve buscar:



\- facilidade de instalação;

\- consistência entre máquinas;

\- reprodução confiável do ambiente.



Evitar depender de configurações manuais não documentadas.



\---



\# Produção



Antes de utilizar Docker em produção:



Validar:



\- funcionamento;

\- variáveis configuradas;

\- persistência dos dados;

\- logs;

\- estratégia de atualização.



\---



\# Alterações em Projetos Existentes



Antes de modificar Docker:



O Cursor Agent deve:



1\. entender a estrutura atual;

2\. identificar serviços afetados;

3\. avaliar impactos;

4\. realizar alterações mínimas;

5\. validar o funcionamento.



\---



\# Regra Final



O Cursor Agent nunca deve assumir:



\- arquitetura Docker;

\- nomes de containers;

\- imagens;

\- portas;

\- estratégia de deploy.



Sempre deve analisar o projeto atual antes de criar ou modificar configurações Docker.

