# Hex Contratar — Outros = produção; Bets = imagem separada (pendente)

## Contexto

O usuário definiu que a imagem do hexágono em **produção** (`hexa-corrigi-2.png` + linhas SVG animadas) **não deve ser alterada** para assinantes de **outros segmentos**. Essa parte **não entra no commit**.

Para assinantes **Bets**, será usada uma **imagem dedicada** que o usuário enviará em seguida.

## Ações executadas

1. `index.html` havia sido truncado por script de restore (`scripts/restore-prod-hex-cluster.mjs`); **recuperado** com `git checkout HEAD -- index.html` (~43.609 linhas).
2. Estado atual do hex no `index.html` (commit HEAD): `hexa-corrigi-2.png` + bloco SVG `.disparos-hex-light-lines` — **paridade produção para todos**.
3. **Não** aplicar troca de arte nem remoção de linhas SVG para Outros no próximo commit.

## Próximo passo (quando o usuário enviar o PNG Bets)

- Salvar em `media/disparos-hex-bets-oficial.png` (ou nome acordado).
- Implementar `syncDisparosHexClusterArt()` **somente** quando `body.waba-subscriber-bets-segment`:
  - `src` da imagem = arte Bets
  - ocultar `.disparos-hex-light-lines` só em Bets
- Outros segmentos: **sem diff** no bloco do hex.

## Arquivos

- `index.html` — restaurado do git (hex produção intacto)
- `scripts/restore-prod-hex-cluster.mjs` — não usar sem revisão (causou corrupção UTF-16)

## Validação

- Outros: hex igual produção (`/media/hexa-corrigi-2.png` + animação SVG).
- Bets: aguardando asset do usuário.

## Palavras-chave

`hex-cluster`, `hexa-corrigi-2`, `bets-segment`, `syncDisparosHexClusterArt`, `paridade-producao`
