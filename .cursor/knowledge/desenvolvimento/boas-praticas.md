\# Boas Práticas de Desenvolvimento - Padrões Gerais



\## Objetivo



Este documento define princípios gerais de qualidade para desenvolvimento de software.



O Cursor Agent deve utilizar estas orientações como referência ao criar, modificar ou revisar código.



O agente nunca deve assumir:



\- linguagem de programação;

\- framework;

\- arquitetura;

\- padrões específicos do projeto.



Sempre analisar o contexto existente antes de implementar.



\---



\# Análise Antes de Codificar



Antes de criar qualquer solução:



O Cursor Agent deve:



1\. entender o objetivo da alteração;

2\. analisar o código existente;

3\. identificar padrões utilizados;

4\. verificar impactos;

5\. implementar a menor alteração necessária.



Evitar criar soluções sem compreender o contexto.



\---



\# Código Limpo



O código deve priorizar:



\- clareza;

\- legibilidade;

\- simplicidade;

\- manutenção futura.



Preferir:



\- nomes descritivos;

\- funções pequenas;

\- responsabilidades claras.



Evitar:



\- código duplicado;

\- funções gigantes;

\- lógica confusa;

\- soluções temporárias sem documentação.



\---



\# Simplicidade



A solução deve ser a mais simples possível para resolver o problema.



Evitar:



\- complexidade desnecessária;

\- abstrações prematuras;

\- padrões aplicados sem necessidade.



Criar complexidade somente quando existir uma necessidade real.



\---



\# Reutilização



Antes de criar algo novo:



Avaliar:



\- funções existentes;

\- componentes existentes;

\- serviços disponíveis;

\- bibliotecas utilizadas.



Evitar duplicação de código.



Porém, não criar abstrações complexas apenas para evitar poucas linhas repetidas.



\---



\# Organização



Manter o projeto organizado.



Considerar:



\- arquivos no local correto;

\- nomes claros;

\- separação de responsabilidades;

\- remoção de código não utilizado.



\---



\# Tratamento de Erros



Todo código deve considerar possíveis falhas.



Avaliar:



\- entradas inválidas;

\- falhas externas;

\- dados inesperados;

\- indisponibilidade de serviços.



Evitar ignorar erros silenciosamente.



\---



\# Segurança



Sempre considerar segurança durante o desenvolvimento.



Nunca inserir diretamente no código:



\- senhas;

\- tokens;

\- chaves privadas;

\- credenciais.



Considerar:



\- validação de dados;

\- controle de acesso;

\- proteção de informações sensíveis.



\---



\# Performance



A performance deve ser considerada sem comprometer a simplicidade.



Avaliar:



\- consultas;

\- processamento desnecessário;

\- consumo de recursos;

\- carregamentos excessivos.



Evitar otimizações sem evidência de problema.



\---



\# Documentação



Documentar decisões importantes.



Registrar quando necessário:



\- motivo da implementação;

\- comportamento esperado;

\- limitações;

\- decisões técnicas.



Evitar comentários que apenas expliquem código óbvio.



\---



\# Alterações em Código Existente



Antes de alterar código existente:



O Cursor Agent deve:



1\. entender o funcionamento atual;

2\. identificar dependências;

3\. avaliar impactos;

4\. preservar comportamentos existentes;

5\. testar após alterações.



Evitar mudanças amplas sem necessidade.



\---



\# Refatoração



Refatorações devem possuir objetivo claro.



Priorizar:



\- melhoria de legibilidade;

\- redução de duplicação;

\- correção de problemas estruturais;

\- melhoria de manutenção.



Evitar refatorar apenas por preferência pessoal.



\---



\# Dependências



Antes de adicionar novas dependências:



Avaliar:



\- necessidade real;

\- impacto;

\- segurança;

\- manutenção futura.



Evitar aumentar a complexidade do projeto sem benefício claro.



\---



\# Validação Antes da Entrega



Antes de considerar uma tarefa concluída:



Verificar:



\- funcionamento esperado;

\- erros existentes;

\- testes disponíveis;

\- impacto da alteração;

\- compatibilidade com o projeto.



\---



\# Regra Especial do Cursor Agent



O Cursor Agent deve:



\- analisar antes de alterar;

\- preservar código existente;

\- evitar decisões arbitrárias;

\- explicar alterações importantes;

\- validar soluções antes de finalizar.



Nunca deve:



\- substituir estruturas existentes sem análise;

\- criar padrões próprios ignorando o projeto;

\- realizar grandes alterações sem necessidade.



\---



\# Regra Final



O objetivo das boas práticas é manter projetos:



\- organizados;

\- seguros;

\- fáceis de evoluir;

\- fáceis de manter.



Toda implementação deve buscar equilíbrio entre:



\- qualidade;

\- simplicidade;

\- prazo;

\- necessidade real do projeto.

