\# Git - Padrões Gerais



\## Objetivo



Este documento define boas práticas gerais para utilização do Git em qualquer projeto.



O Cursor Agent deve utilizar estas orientações como referência ao criar, alterar, versionar ou publicar código.



O agente nunca deve assumir:



\- nome de branches;

\- fluxo de trabalho da equipe;

\- política de commits;

\- estrutura do repositório.



Sempre analisar o padrão existente antes de realizar alterações.



\---



\# Análise Antes de Alterações



Antes de modificar código:



O Cursor Agent deve:



1\. verificar o estado atual do repositório;

2\. identificar alterações pendentes;

3\. entender a branch atual;

4\. verificar padrões existentes;

5\. evitar sobrescrever alterações do usuário.



Nunca apagar ou substituir alterações existentes sem confirmação.



\---



\# Commits



Os commits devem representar alterações claras e organizadas.



Boas práticas:



\- um objetivo por commit;

\- mensagens descritivas;

\- evitar commits genéricos.



Evitar mensagens como:
ajustes

correção

mudanças

teste



Preferir mensagens que expliquem a intenção da alteração.



Exemplo:

corrige validação de formulário de cadastro



\---



\# Antes do Commit



Antes de criar um commit:



O Cursor Agent deve verificar:



\- código compilando;

\- testes executados quando disponíveis;

\- arquivos necessários incluídos;

\- arquivos temporários removidos.



Nunca realizar commit de código quebrado.



\---



\# Branches



A estratégia de branches deve seguir o padrão existente no projeto.



Antes de criar uma branch:



Avaliar:



\- fluxo utilizado;

\- ambiente de destino;

\- processo de revisão.



Evitar criar branches sem necessidade.



\---



\# Pull Requests



Quando o projeto utilizar Pull Requests:



A alteração deve conter:



\- descrição clara;

\- objetivo;

\- impacto;

\- validações realizadas.



Facilitar a revisão por outras pessoas.



\---



\# Histórico do Projeto



Manter o histórico do Git organizado.



Evitar:



\- commits gigantes sem justificativa;

\- misturar várias funcionalidades diferentes;

\- incluir arquivos desnecessários.



\---



\# Conflitos



Ao resolver conflitos:



O Cursor Agent deve:



1\. entender as duas alterações;

2\. identificar qual comportamento deve permanecer;

3\. evitar simplesmente aceitar uma versão;

4\. validar após a resolução.



\---



\# Arquivos Sensíveis



Nunca versionar:



\- senhas;

\- tokens;

\- chaves privadas;

\- arquivos de ambiente com dados reais;

\- informações confidenciais.



Utilizar:



\- `.gitignore`;

\- variáveis de ambiente;

\- gerenciamento seguro de secrets.



\---



\# Git Ignore



Antes de adicionar arquivos ao repositório:



Verificar se devem ser ignorados.



Exemplos comuns:



\- dependências instaladas;

\- arquivos temporários;

\- logs;

\- arquivos de configuração local.



\---



\# Alterações em Projetos Existentes



Antes de executar comandos Git que possam impactar o projeto:



O Cursor Agent deve:



1\. verificar o estado atual;

2\. preservar alterações existentes;

3\. evitar comandos destrutivos;

4\. confirmar impactos quando necessário.



\---



\# Regra Especial do Cursor Agent



O Cursor Agent nunca deve:



\- fazer commit automaticamente sem validação;

\- remover alterações do usuário;

\- executar comandos destrutivos sem confirmação;

\- substituir histórico existente.



Antes de qualquer commit, validar:



\- funcionamento;

\- testes;

\- impacto da alteração.



\---



\# Regra Final



O Git deve ser utilizado como ferramenta de controle e segurança do desenvolvimento.



O objetivo principal é manter:



\- histórico confiável;

\- alterações rastreáveis;

\- código organizado;

\- facilidade de manutenção.



