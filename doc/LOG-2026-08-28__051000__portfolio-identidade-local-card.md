# Identidade local do card do portfólio

## Contexto

Mudar nome e foto do portfólio empresarial no Laboratório ainda falhava. A Meta não grava `profile_picture_uri` no Business Manager (só leitura) e este BM não tem Página do Facebook. O POST do nome também pode falhar (código 3910) se o token do Embedded Signup não for admin do Business. A UI bloqueava a foto e o card continuava com o nome/logo da Meta.

## Solução

O card do Laboratório passa a ser a fonte de verdade da identidade visível:

1. Nome e foto são gravados em `data/.../meta-whatsapp/portfolio-identity/` (JSON + PNG/JPG por tenant).
2. A listagem aplica esse overlay no DTO público.
3. `GET /integrations/meta/whatsapp/portfolio/photo` devolve o arquivo da sessão (cookie, sem cache).
4. A Graph da Meta continua best-effort (nome no Business, foto só se houver Página). Falha da Meta não desfaz o card.

## Arquivos

- `src/integrations/meta-whatsapp/meta-whatsapp-portfolio-identity.store.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-connection.service.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp.routes.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-portfolio.test.ts`
- `index.html` / `dist/index.html`
- `dist/integrations/meta-whatsapp/*` dos ficheiros acima

## Como validar

- `npm run test:meta-portfolio`
- No Laboratório: Editar portfólio → nome + PNG → o CARD 02 deve mostrar os dois na hora, mesmo sem Página na Meta.

## Palavras-chave

portfolio, foto, nome, identidade-local, business-manager, pagina-facebook
