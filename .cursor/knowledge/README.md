\# Knowledge Base - Cursor Agent



\## Objetivo



Esta pasta contém informações técnicas, arquiteturais e padrões de desenvolvimento que devem ser utilizados pelo Cursor Agent durante a criação, manutenção e evolução dos sistemas.



Antes de criar qualquer código, o agente deve consultar os arquivos desta Knowledge Base para entender:



\- arquitetura utilizada;

\- tecnologias adotadas;

\- padrões de implementação;

\- integrações existentes;

\- regras de negócio;

\- boas práticas obrigatórias.



\---



\# Regra principal



O Cursor Agent deve sempre priorizar as informações existentes nesta Knowledge Base antes de tomar decisões técnicas.



Caso exista uma orientação neste diretório, ela deve ser seguida.



Caso uma decisão nova seja necessária, o agente deve:



1\. avaliar impacto na arquitetura existente;

2\. evitar criar soluções conflitantes;

3\. manter padrão já utilizado no projeto;

4\. documentar novas decisões importantes.



\---



\# Organização da Knowledge Base



\## backend/



Contém informações relacionadas ao lado servidor:



\- APIs;

\- serviços;

\- banco de dados;

\- filas;

\- autenticação;

\- regras de negócio.



\---



\## frontend/



Contém padrões relacionados à interface:



\- React;

\- Next.js;

\- componentes;

\- estilos;

\- bibliotecas utilizadas.



\---



\## integracoes/



Contém documentação das integrações externas:



\- WhatsApp;

\- Evolution API;

\- Meta API;

\- Google APIs;

\- serviços terceiros.



\---



\## infraestrutura/



Contém informações sobre ambiente:



\- Docker;

\- EasyPanel;

\- Traefik;

\- servidores;

\- deploy;

\- redes.



\---



\## banco-dados/



Contém padrões relacionados a persistência:



\- PostgreSQL;

\- Supabase;

\- migrations;

\- SQL.



\---



\## desenvolvimento/



Contém padrões gerais:



\- Git;

\- arquitetura;

\- testes;

\- boas práticas.



\---



\# Regras de Desenvolvimento



\## Código



O agente deve:



\- escrever código limpo e organizado;

\- evitar duplicação;

\- criar componentes reutilizáveis;

\- manter nomes claros;

\- seguir padrões existentes.



\---



\## Alterações



Antes de modificar arquivos existentes:



\- analisar impacto;

\- verificar dependências;

\- evitar alterações desnecessárias.



\---



\## Testes



Toda implementação deve ser validada antes de ser considerada concluída.



O agente deve:



\- executar testes quando existirem;

\- validar funcionamento;

\- informar possíveis limitações.



\---



\## Banco de Dados



Nunca alterar estrutura de banco diretamente sem considerar:



\- migrations;

\- compatibilidade;

\- dados existentes;

\- impacto no sistema.



\---



\## Segurança



O agente deve considerar:



\- proteção de dados;

\- variáveis de ambiente;

\- autenticação;

\- autorização;

\- boas práticas de segurança.



\---



\# Padrão de Resposta do Cursor Agent



Ao finalizar uma tarefa, informar:



1\. O que foi alterado;

2\. Arquivos modificados;

3\. Como foi validado;

4\. Possíveis próximos passos.



\---



\# Evolução da Knowledge Base



Sempre que uma decisão arquitetural importante for tomada, ela deve ser documentada no arquivo correspondente.



A Knowledge Base deve evoluir junto com o projeto.


---



\# Hierarquia de Conhecimento



A Knowledge Base possui informações globais que devem ser aplicadas como padrão geral para todos os projetos.



Porém, cada projeto pode possuir regras específicas dentro da sua própria documentação.



A prioridade deve seguir:



1\. Regras específicas do projeto;

2\. Arquitetura existente do projeto;

3\. Esta Knowledge Base global;

4\. Boas práticas gerais da tecnologia utilizada.



Caso exista conflito entre uma regra global e uma decisão específica documentada do projeto, a decisão específica deve prevalecer.



\---



\# Antes de Implementar



Antes de criar qualquer funcionalidade, o Cursor Agent deve:



1\. analisar a estrutura atual do projeto;

2\. consultar os arquivos relevantes desta Knowledge Base;

3\. verificar padrões já existentes;

4\. evitar criar novas tecnologias ou arquiteturas sem necessidade;

5\. manter consistência com o código existente.



\---



\# Novas Decisões Técnicas



Quando uma nova decisão arquitetural ou técnica for tomada:



Registrar no local adequado:



\- tecnologia utilizada;

\- motivo da escolha;

\- impacto;

\- padrões definidos.



A Knowledge Base deve representar o conhecimento acumulado dos projetos.

