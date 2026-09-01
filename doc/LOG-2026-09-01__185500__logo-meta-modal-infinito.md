# Logo Meta do modal de envio

## Contexto

O modal de cadastro das três opções mostrava um desenho que parecia o infinito da Meta colado a um círculo (alvo/rádio). Ficou estranho.

## Causa

O SVG de fallback era um traçado improvisado (dois paths). Sem `/media/meta-logo.png` no preview, só esse desenho aparecia.

## Solução

Usar o mesmo SVG do botão **Conectar Portfólio** (`viewBox="0 0 24 16"`, infinito oficial do sistema), em azul `#60a5fa`, sem PNG.

## Arquivos

- `index.html`
- `src/deploy-marker.ts`

## Como validar

Abrir o modal **Enviar para META** e conferir um único infinito Meta, igual ao CTA de portfólio.

## Palavras-chave

logo, meta, infinito, modal, svg
