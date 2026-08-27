# LOG — Telas oficiais só no localhost V02

## Contexto

Validar o card de portfólio e a lista de números **somente** em `http://localhost:3012/version-02/`, sem aparecer em produção.

## Solução

- Flag `metaOfficialPortfolioLab`: `WABA_ENV=v02` e `RUNTIME_MODE` diferente de `production`.
- UI: classe `waba-meta-portfolio-lab`; Laboratório visível no V02 local após login.
- API `/portfolio` e `/phone-numbers/register` respondem 404 fora desse ambiente.

## Validar

Abrir `http://localhost:3012/version-02/` com o V02 local (`npm run dev:v02`). Produção não mostra o card novo.
