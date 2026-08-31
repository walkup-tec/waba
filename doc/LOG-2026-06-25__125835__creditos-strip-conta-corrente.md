# LOG — Faixa superior no menu Créditos

## Contexto

Ao clicar em **Créditos**, a faixa superior (`integration-env-strip`) deve mostrar **Sua conta corrente** e, na linha abaixo, **Compre seus créditos** — em vez de "Você está no ambiente" + API Oficial/Aquecedor.

## Solução

- `syncIntegrationEnvCreditsStrip(true)` quando `activeTab === disparos-lancamento`.
- Classe `integration-env-credits-active` no `body`: faixa neutra e toggle de ambiente oculto.
- Ao sair de Créditos, restaura título padrão e `applyIntegrationEnvironment` normal.

## Arquivos

- `index.html` / `dist/index.html`

## Validar

1. Abrir **Créditos** → faixa com "SUA CONTA CORRENTE" / "Compre seus créditos".
2. Ir para Campanhas ou Aquecedor → faixa volta ao comportamento anterior.

## Palavras-chave

`integration-env-credits-active`, `syncIntegrationEnvCreditsStrip`, `disparos-lancamento`
