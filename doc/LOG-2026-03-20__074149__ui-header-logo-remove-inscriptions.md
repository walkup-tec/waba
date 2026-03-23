# LOG - Header branding: remover inscrições e usar logo DRAX

## Contexto
O usuário reportou que a logo não estava aparecendo e pediu:
- remover as inscrições visíveis do header (“Dashboard de Envios” e “Monitor em tempo real...”)
- deixar o header com a mesma logo do site `draxsistemas.com.br` (conforme print enviado)
- manter o favicon alinhado com o branding do site

## Comandos executados / ações
- Atualizei `index.html` (branding do header + favicon)
- Executei `npm run build` para atualizar `dist/index.html`
- Validei no HTML servido que o asset do logo/favIcon aparece:
  - `Drax-logo-footer.png` presente em `http://localhost:3000/`

## Solução implementada (passo a passo)
1. Header (frontend)
   - Removi o bloco de texto (`title-text`) do header, deixando apenas o logo.
   - Adicionei apenas um texto “sr-only” (`DRAX`) para acessibilidade, sem aparecer visualmente.
   - Troquei o `src` do logo para o mesmo asset do site:
     - `https://draxsistemas.com.br/assets/media/Drax-logo-footer.png`

2. Favicon
   - Substituí o `favicon` por `Drax-logo-footer.png` (para ficar idêntico ao que o usuário espera no print).

3. Title do navegador
   - Ajustei o `<title>` para remover “Dashboard de Envios”.

4. Build
   - `npm run build` para copiar o `index.html` atualizado para `dist/`.

## Arquivos criados/alterados
- Alterado: `index.html`
- Alterado por build: `dist/index.html`
- Criado: `doc/LOG-2026-03-20__074149__ui-header-logo-remove-inscriptions.md`

## Como validar
- Hard refresh no navegador (Ctrl+F5).
- Confirmar no DOM visível do header:
  - não deve aparecer “Dashboard de Envios” / “Monitor em tempo real...”
  - deve aparecer a logo da DRAX
- Confirmar no Network:
  - `Drax-logo-footer.png` retornando `200`.

## Observações de segurança
- Sem segredos.

## Itens para evitar duplicação (keywords)
- header-branding
- Drax-logo-footer.png
- remove-inscriptions

