# LOG — Cupons: lista única com filtro Desconto/Envios

## Contexto
Usuário pediu uma única listagem de cupons (ativos/inativos) com filtro por tipo (Desconto vs Envios), em vez de duas tabelas, e melhor uso de espaço na tela.

## Solução
1. Bloco **Cupons** com os dois formulários (Bônus Envios + Cupom de desconto) e **uma** tabela.
2. Toolbar: filtros **Desconto | Envios** + **Ativos | Inativos** + Atualizar.
3. Caches separados (`adminCouponsCache` / `adminBonusEnviosCache`); render unificado via `renderAdminCuponsTableFromCache`.
4. Coluna **Tipo** removida (tipo já vem do filtro) para ganhar espaço.
5. Forms em grid 2 colunas (≥1100px); campos internos em 2 colunas.

## Arquivos
- `index.html` — HTML/CSS/JS unificados
- `doc/memoria.md` — entrada desta tarefa

## Validação
- Assinantes → Cupons: trocar Desconto/Envios e Ativos/Inativos sem segunda lista.
- Criar cupom / creditar envios → lista muda para o tipo criado.
- Desativar item → aparece em Inativos do tipo correspondente.
- Botão Atualizar recarrega os dois endpoints.

## Palavras-chave
cupons, lista unica, filtro desconto envios, bonus envios, admin assinantes, otimizacao espaco
