\# APIs - Padrões Gerais



\## Objetivo



Este documento define boas práticas gerais para desenvolvimento e manutenção de APIs em qualquer projeto.



O Cursor Agent deve utilizar estas orientações como referência, mas nunca deve assumir:



\- linguagem utilizada;

\- framework utilizado;

\- estrutura de endpoints;

\- modelo de autenticação;

\- regras de negócio.



Cada projeto possui sua própria arquitetura e documentação complementar.



\---



\# Análise Antes da Implementação



Antes de criar ou alterar uma API, o Cursor Agent deve:



1\. analisar a arquitetura existente;

2\. identificar padrões utilizados;

3\. verificar endpoints existentes;

4\. entender contratos de comunicação;

5\. evitar criar padrões paralelos.



Manter consistência com o projeto atual.



\---



\# Arquitetura



A API deve possuir separação clara entre responsabilidades.



Considerar separação entre:



\- rotas/endpoints;

\- controladores;

\- serviços;

\- acesso a dados;

\- validações;

\- integrações externas.



Evitar concentrar toda lógica em um único arquivo.



\---



\# Endpoints



Os endpoints devem:



\- possuir nomes claros;

\- seguir padrão consistente;

\- representar recursos da aplicação;

\- evitar nomes genéricos.



Exemplo conceitual:
GET /recursos

POST /recursos

PUT /recursos/{id}

DELETE /recursos/{id}



O padrão específico deve seguir a arquitetura existente.



\---



\# Métodos HTTP



Utilizar corretamente os métodos HTTP:



\## GET



Utilizado para consulta de informações.



\## POST



Utilizado para criação de recursos ou execução de ações.



\## PUT/PATCH



Utilizados para atualização.



\## DELETE



Utilizado para remoção quando aplicável.



\---



\# Validação de Dados



Toda entrada externa deve ser validada.



Considerar:



\- campos obrigatórios;

\- formatos;

\- limites;

\- regras de negócio;

\- segurança.



Nunca confiar diretamente em dados enviados pelo cliente.



\---



\# Respostas da API



As respostas devem possuir padrão consistente.



Considerar:



\- status HTTP adequado;

\- mensagens claras;

\- estrutura previsível;

\- tratamento de erros.



Evitar respostas diferentes para situações semelhantes.



\---



\# Tratamento de Erros



A API deve tratar:



\- erros esperados;

\- falhas de integração;

\- dados inválidos;

\- indisponibilidade de serviços.



Evitar retornar erros técnicos internos diretamente ao usuário final.



\---



\# Autenticação e Autorização



Antes de implementar acesso a recursos:



Avaliar:



\- método de autenticação utilizado;

\- permissões necessárias;

\- níveis de acesso;

\- proteção dos dados.



Autenticação e autorização são responsabilidades diferentes.



\---



\# Segurança



Considerar:



\- validação de entradas;

\- proteção contra abuso;

\- controle de permissões;

\- proteção de dados sensíveis;

\- gerenciamento seguro de credenciais.



Nunca armazenar:



\- tokens;

\- senhas;

\- chaves privadas;



diretamente no código.



\---



\# Versionamento



Quando necessário, APIs devem possuir estratégia de versionamento.



Exemplo:
/api/v1/recurso



O padrão deve seguir a necessidade do projeto.



\---



\# Documentação



Toda API deve possuir documentação suficiente para manutenção.



Considerar documentar:



\- objetivo do endpoint;

\- parâmetros;

\- respostas;

\- erros possíveis;

\- autenticação necessária.



\---



\# Integrações Externas



Ao integrar serviços externos:



O Cursor Agent deve considerar:



\- limites da API;

\- tratamento de falhas;

\- timeout;

\- retries;

\- logs.



Nunca assumir que serviços externos estarão sempre disponíveis.



\---



\# Performance



Avaliar:



\- quantidade de dados retornados;

\- paginação;

\- consultas ao banco;

\- tempo de resposta;

\- volume esperado.



Evitar endpoints que retornam dados desnecessários.



\---



\# Testes



Alterações em APIs devem considerar:



\- testes automatizados quando disponíveis;

\- validação dos cenários principais;

\- testes de erro;

\- compatibilidade com consumidores existentes.



\---



\# Alterações em Projetos Existentes



Antes de alterar uma API existente:



O Cursor Agent deve:



1\. verificar consumidores atuais;

2\. avaliar impacto;

3\. manter compatibilidade quando possível;

4\. documentar mudanças importantes.



\---



\# Regra Final



O Cursor Agent nunca deve assumir:



\- endpoints existentes;

\- contratos de API;

\- autenticação;

\- regras de negócio.



Sempre deve analisar o projeto atual antes de criar ou modificar APIs.







