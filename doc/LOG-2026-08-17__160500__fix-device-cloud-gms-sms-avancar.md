# Device Cloud: Avançar voltava ao número por falta de SMS no Play Services

## Contexto

No Android teste 1 o Digitar preenchia `51 98200-6034`, mas o WhatsApp Business não saía da tela do número. Aparecia o aviso do Google Play Services (“Tap to finish setup”) e, após Continuar, a tela voltava ao cadastro.

## Evidência no aparelho (produção)

1. Avançar em `360,1100` (teclado fechado) abriu o diálogo “número já confirmado”.
2. Continuar em `520,768` voltava ao número com o heads-up do Play.
3. O aviso pede para terminar o setup do Play no WhatsApp Business.
4. Abrir a notificação (`160,470` na shade) → “Complete a ação usando Google Play Services” → OPEN SETTINGS → Permissões → SMS/Telefone = Permitir.
5. Depois disso, Avançar + Continuar chegaram em **Confirmar seu número** (aguardando SMS de 6 dígitos para `+55 51 98200-6034`).

Causa raiz: o Play Services não tinha permissão de SMS. O WhatsApp não consegue verificar o número e desfaz o avanço.

## Solução

- Após Digitar: Avançar `690` (pad aberto) e `1100` (pad fechado), depois Continuar `520,768`.
- Se o screenshot do topo ainda tiver o heads-up branco do Play, conceder SMS nas configurações do Play e repetir Avançar/Continuar.
- A API de swipe passa a respeitar `durationMs` (antes ficava fixo em 280).

## Como validar

No Dispositivos, Android teste 1: após Digitar, a tela deve ir para confirmação SMS (ou o diálogo Continuar), não permanecer só no cadastro do número com o erro do Play.

## Segurança

Nenhuma chave foi registrada neste log.
