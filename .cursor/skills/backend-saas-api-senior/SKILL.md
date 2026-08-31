---
name: backend-saas-api-senior
description: >-
  Cria e ajusta APIs backend escaláveis seguindo Clean Architecture (controller,
  service, repository), com foco em segurança, performance e isolamento de dados
  por tenant_id. Use quando o usuário pedir criação/alteração de endpoints,
  estrutura de código backend, camada de service/repository, ou melhorias de
  segurança/performance em um sistema multi-tenant.
---

# Backend SaaS API (Service Layer + Multi-tenant)

## Diretrizes obrigatórias

- Sempre usar a camada `service` para qualquer regra de negócio (não misturar regras com controller).
- Separar responsabilidades em camadas:
  - `controller`: recebe/valida requisição, chama `service` e formata resposta.
  - `service`: regra de negócio, orquestra validações, autorizações e transações.
  - `repository`: acesso a dados (queries/ORM), sem lógica de negócio.
- Considerar multi-tenant desde o design:
  - `tenant_id` deve existir e ser propagado do controller para o service e para o repository.
  - Todas as leituras/escritas devem filtrar por `tenant_id` (ou validar pertencimento antes de atualizar/deletar).
- Segurança e performance são parte do contrato da entrega:
  - Validar entradas (tipos, campos obrigatórios, limites) antes de chamar o service/repository.
  - Autorizar ações no service usando contexto de autenticação e `tenant_id`.
  - Evitar vazamento de dados (nunca retornar segredos; mensagens de erro não devem revelar detalhes sensíveis).
  - Pensar em escala: paginação, seleção apenas de campos necessários, evitar N+1, e sugerir índices quando fizer sentido.

## Responsabilidades
- Criar APIs robustas e seguras.
- Estruturar o sistema em camadas (`controller`, `service`, `repository`).
- Implementar regras de negócio corretamente no `service` (nunca no controller).
- Garantir isolamento de dados por `tenant_id` em todas as operações.
- Validar entradas, aplicar autenticação/autorização e tratar erros de forma consistente.

## Arquitetura (Clean Architecture)
- Separar responsabilidades e seguir Clean Architecture:
  - `controller`: valida/normaliza request e resposta
  - `service`: regra de negócio, transações e autorização
  - `repository`: acesso a dados e queries
- Não misturar regra de negócio com controller.

## SaaS (Multi-tenant)
- Sempre considerar multi-tenant.
- Usar `tenant_id` para isolar dados.
- Todas as leituras/escritas devem filtrar por `tenant_id` (ou validar pertencimento antes de mutar).

## Segurança
- Validar todas entradas antes de acessar o banco.
- Autenticação e autorização devem ser aplicadas no fluxo do `service` usando contexto da request.
- Proteger dados sensíveis: não retornar segredos e não expor detalhes internos em mensagens ao cliente.

## Banco de dados
- Modelagem eficiente (entidades claras e relacionamentos bem definidos).
- Queries otimizadas:
  - evitar `N+1` (prefira batch/joins na camada de repository)
  - selecionar apenas campos necessários (evitar `select *`)
- Uso adequado de índices, especialmente para padrões que incluem `tenant_id`.

## Nunca
- Gerar código desorganizado.
- Ignorar tratamento de erros (validação, não encontrado, falha de negócio, erro interno).
- Misturar regra de negócio com controller.
- Acessar dados sem garantir o boundary de tenant (`tenant_id`).

## Workflow recomendado

1. Entender o pedido e identificar o que está mudando (novo endpoint, alteração de endpoint existente, ou refatoração arquitetural).
2. Levantar/confirmar pré-requisitos que afetam o design:
   - mecanismo de autenticação/autorização disponível
   - como o `tenant_id` é obtido (claims do token, header, sessão, etc.)
   - banco/ORM e convenções do projeto
3. Propor/ajustar o contrato:
   - DTOs de entrada/saída, códigos de erro e mensagens padronizadas
   - paginação e ordenação quando houver listagens
4. Implementar por camadas:
   - criar/ajustar controller -> chamar service -> service -> repository
   - garantir que `tenant_id` está presente em todas as chamadas do repository
5. Segurança:
   - garantir checagens de autorização e tenant boundaries
   - tratamento consistente de erro (ex.: validação vs falha de negócio vs não encontrado)
6. Performance:
   - evitar queries desnecessárias
   - evitar N+1 e sugerir abordagens (batch/joins) quando aplicável
7. Testes:
   - ao menos testes unitários do service cobrindo tenant isolation e regras principais
   - idealmente teste de integração para o controller/end-to-end do endpoint

## Checklist antes de finalizar

- [ ] Toda regra de negócio está no `service`.
- [ ] Controller não acessa o banco diretamente.
- [ ] Repository só acessa dados e recebe `tenant_id` (por assinatura ou contexto).
- [ ] Consultas de leitura/escrita incluem `tenant_id` (ou valida pertencimento antes de mutar dados).
- [ ] Entradas foram validadas (campos, tipos, limites).
- [ ] Autorização foi aplicada no service.
- [ ] Erros são padronizados e não vazam detalhes sensíveis.
- [ ] Listagens suportam paginação e evitam retorno excessivo.
- [ ] Foram considerados impactos de performance (N+1, índices/padrões de query) quando relevante.
- [ ] Testes cobrem isolamento por tenant e casos de negócio críticos.

## Formato de resposta esperado

Quando entregar uma mudança, responder com:

- Resumo do que foi ajustado (1-3 frases).
- Novos/alterados endpoints e contratos (DTOs/inputs/outputs).
- Estrutura por camadas (controller/service/repository) e como `tenant_id` flui.
- Notas de segurança e performance (o que foi garantido e por quê).
- Plano mínimo de testes (o que validar e como).

## Protocolo de assertividade (reduzir retrabalho)

Antes de codar, o agente deve:

1. Reafirmar o objetivo em 1-2 frases, explicitando: endpoint (ou fluxo), tenant_id e entidade afetada.
2. Verificar pré-requisitos. Se qualquer item abaixo estiver ausente, o agente deve perguntar antes de implementar:
   - mecanismo de autenticação/autorização disponível (JWT, sessão, middleware, etc.)
   - como `tenant_id` é obtido (claims/header/sessao) e onde isso está armazenado no contexto da request
   - padrão de resposta de erro usado no projeto (status codes e payload)
   - biblioteca/ORM e forma de fazer queries no repositório (ex.: Supabase, Prisma, TypeORM)
   - framework de testes existente (se houver) e padrão de mocks/stubs
   - requisitos de paginação/ordenação para listagens (campos permitidos e limites)
   - necessidade de transações ou consistencia forte (quando aplicável)
3. Listar suposicoes se for inevitavel prosseguir sem detalhes, e pedir confirmacao das suposicoes antes de finalizar.

Durante a implementação, o agente deve:

1. Restringir o escopo ao necessário. Se for necessária uma refatoração ampla, ele deve propor o plano e pedir aprovação.
2. Garantir que `tenant_id` trafega desde o controller até o repository em toda chamada de leitura/escrita.
3. Aplicar autorização no service (nunca no controller) verificando pertencimento do recurso ao tenant.
4. Evitar retorno excessivo em endpoints de listagem (paginaçao + limites + seleção de campos).

Ao finalizar, o agente deve incluir no output:

- Lista objetiva de arquivos alterados/criados.
- Como o tenant boundary foi preservado (ex.: filtros no repository e checagens no service).
- O que foi validado/checado (ex.: cenarios de sucesso, falha, não encontrado, acesso entre tenants).

## Referencias e exemplos

Para aumentar consistencia e reduzir retrabalho, consulte:

- [reference.md](reference.md): templates de DTO, erros e tenant boundary.
- [examples.md](examples.md): exemplos de fluxo controller/service/repository com `tenant_id`.

