\# Arquitetura de Software - Padrões Gerais



\## Objetivo



Este documento define princípios gerais de arquitetura de software que devem ser considerados em qualquer projeto.



O Cursor Agent deve utilizar estas orientações como referência ao criar, modificar ou analisar sistemas.



O agente nunca deve assumir:



\- linguagem de programação;

\- framework;

\- banco de dados;

\- estrutura de pastas;

\- padrão arquitetural específico.



Sempre analisar a arquitetura existente antes de implementar.



\---



\# Análise Antes da Implementação



Antes de criar uma nova funcionalidade:



O Cursor Agent deve:



1\. entender a estrutura atual;

2\. identificar responsabilidades existentes;

3\. localizar componentes relacionados;

4\. verificar padrões utilizados;

5\. evitar criar soluções paralelas.



A solução deve se integrar à arquitetura existente.



\---



\# Princípios Fundamentais



A arquitetura deve buscar:



\- baixo acoplamento;

\- alta coesão;

\- facilidade de manutenção;

\- escalabilidade;

\- clareza de responsabilidades.



Evitar soluções que funcionam apenas para o cenário atual sem considerar evolução futura.



\---



\# Separação de Responsabilidades



Cada camada ou módulo deve possuir uma responsabilidade clara.



Separar quando aplicável:



\- interface;

\- regras de negócio;

\- acesso a dados;

\- integrações;

\- serviços auxiliares;

\- configurações.



Evitar concentrar toda lógica em um único local.



\---



\# Organização do Código



O código deve ser organizado considerando:



\- facilidade de localização;

\- manutenção futura;

\- reutilização;

\- entendimento por novos desenvolvedores.



A estrutura deve seguir os padrões já existentes no projeto.



\---



\# Reutilização



Antes de criar algo novo:



Avaliar:



\- componentes existentes;

\- funções disponíveis;

\- serviços já implementados;

\- bibliotecas utilizadas.



Evitar duplicar funcionalidades existentes.



\---



\# Dependências



Toda dependência adicionada deve ser avaliada.



Considerar:



\- necessidade real;

\- impacto no projeto;

\- manutenção futura;

\- segurança;

\- compatibilidade.



Evitar adicionar tecnologias apenas por conveniência.



\---



\# Comunicação Entre Módulos



A comunicação entre partes do sistema deve ser clara.



Considerar:



\- contratos bem definidos;

\- responsabilidades separadas;

\- baixo acoplamento.



Evitar dependências ocultas entre módulos.



\---



\# Escalabilidade



Ao implementar funcionalidades, considerar:



\- crescimento de usuários;

\- aumento de dados;

\- aumento de integrações;

\- necessidade futura de manutenção.



Não criar complexidade desnecessária, mas evitar soluções que dificultem evolução.



\---



\# Configurações



Separar:



\- código;

\- configurações;

\- informações sensíveis.



Nunca inserir diretamente no código:



\- senhas;

\- tokens;

\- chaves;

\- credenciais.



Utilizar mecanismos adequados de configuração.



\---



\# Documentação Técnica



Decisões arquiteturais importantes devem ser documentadas.



Registrar quando necessário:



\- motivo da decisão;

\- impacto;

\- limitações;

\- alternativas avaliadas.



\---



\# Alterações em Projetos Existentes



Antes de modificar arquitetura:



O Cursor Agent deve:



1\. entender o funcionamento atual;

2\. identificar impactos;

3\. evitar grandes mudanças sem necessidade;

4\. preservar compatibilidade;

5\. validar após alterações.



\---



\# Refatoração



Refatorações devem ter objetivo claro.



Priorizar:



\- melhoria de manutenção;

\- redução de duplicação;

\- melhoria de legibilidade;

\- correção de problemas estruturais.



Evitar refatorações grandes sem necessidade.



\---



\# Testabilidade



A arquitetura deve facilitar testes.



Considerar:



\- componentes isolados;

\- responsabilidades claras;

\- baixo acoplamento;

\- facilidade de simulação.



\---



\# Regra Final



O Cursor Agent nunca deve impor uma arquitetura própria ao projeto.



Antes de implementar qualquer solução:



\- analisar o padrão existente;

\- respeitar decisões já tomadas;

\- alterar somente o necessário;

\- manter consistência com o projeto atual.



