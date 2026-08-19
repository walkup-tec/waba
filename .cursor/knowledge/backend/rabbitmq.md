\# RabbitMQ - Padrões Gerais



\## Objetivo



Este documento define boas práticas gerais para utilização do RabbitMQ em qualquer projeto.



O Cursor Agent deve utilizar estas orientações como referência quando implementar sistemas baseados em mensageria, filas ou processamento assíncrono.



O agente nunca deve assumir:



\- nomes de filas;

\- exchanges existentes;

\- estrutura de mensagens;

\- regras específicas de negócio.



Cada projeto deve possuir sua própria documentação complementar.



\---



\# Conceito Geral



O RabbitMQ deve ser utilizado quando uma funcionalidade precisa de:



\- processamento assíncrono;

\- desacoplamento entre serviços;

\- distribuição de tarefas;

\- comunicação entre sistemas;

\- controle de filas.



Antes de implementar uma fila, avaliar se realmente existe necessidade de processamento assíncrono.



\---



\# Análise Antes da Implementação



Antes de criar qualquer integração RabbitMQ:



O Cursor Agent deve analisar:



1\. arquitetura atual;

2\. serviços existentes;

3\. padrões de comunicação utilizados;

4\. necessidade real da fila;

5\. impacto operacional.



Evitar adicionar mensageria apenas para substituir chamadas simples entre serviços.



\---



\# Estrutura Conceitual



O RabbitMQ possui componentes principais:



\## Producer



Responsável por publicar mensagens.



Exemplos:



\- aplicação enviando eventos;

\- serviço criando tarefas;

\- sistema gerando processamento.



\---



\## Exchange



Responsável pelo roteamento das mensagens.



Avaliar:



\- tipo de exchange;

\- regras de roteamento;

\- necessidade do projeto.



\---



\## Queue



Responsável por armazenar mensagens até serem processadas.



As filas devem possuir:



\- propósito claro;

\- nome padronizado;

\- documentação;

\- monitoramento.



\---



\## Consumer



Responsável por consumir e processar mensagens.



Deve considerar:



\- tratamento de erros;

\- confirmação de processamento;

\- comportamento em caso de falha.



\---



\# Padrão de Mensagens



As mensagens devem possuir estrutura clara.



Considerar:



\- identificação da mensagem;

\- origem;

\- data de criação;

\- tipo do evento;

\- dados necessários.



Evitar enviar informações desnecessárias.



\---



\# Confirmação de Processamento



O sistema deve definir corretamente:



\- quando uma mensagem é considerada concluída;

\- quando deve ocorrer retry;

\- quando deve ser descartada.



Evitar remover mensagens antes da confirmação de processamento.



\---



\# Tratamento de Erros



Toda implementação deve considerar:



\- falhas temporárias;

\- indisponibilidade de serviços;

\- mensagens inválidas;

\- processamento incompleto.



Avaliar utilização de:



\- retry;

\- dead letter queue;

\- logs;

\- alertas.



\---



\# Idempotência



Consumidores devem ser preparados para evitar processamento duplicado.



Considerar:



\- identificador único da mensagem;

\- controle de processamento;

\- validação antes de executar ações.



Uma mensagem pode ser entregue mais de uma vez.



\---



\# Performance



Avaliar:



\- quantidade de consumidores;

\- tamanho das mensagens;

\- volume esperado;

\- tempo de processamento.



Evitar:



\- mensagens muito grandes;

\- processamento bloqueante;

\- filas sem monitoramento.



\---



\# Segurança



Considerar:



\- autenticação;

\- autorização;

\- proteção de credenciais;

\- isolamento de ambientes.



Nunca armazenar:



\- usuários;

\- senhas;

\- tokens;



diretamente no código.



\---



\# Monitoramento



Ambientes com RabbitMQ devem considerar acompanhamento de:



\- mensagens pendentes;

\- mensagens processadas;

\- falhas;

\- tempo de processamento;

\- crescimento das filas.



\---



\# Alterações em Projetos Existentes



Antes de criar ou alterar filas:



O Cursor Agent deve:



1\. identificar produtores existentes;

2\. identificar consumidores existentes;

3\. verificar contratos de mensagens;

4\. avaliar impacto;

5\. manter compatibilidade.



\---



\# Documentação



Toda nova implementação RabbitMQ deve documentar:



\- objetivo da fila;

\- origem das mensagens;

\- destino;

\- formato da mensagem;

\- comportamento em caso de erro.



\---



\# Regra Final



O Cursor Agent nunca deve assumir:



\- arquitetura de mensageria;

\- nomes de filas;

\- exchanges;

\- formato das mensagens.



Sempre deve analisar o projeto atual antes de implementar RabbitMQ.

