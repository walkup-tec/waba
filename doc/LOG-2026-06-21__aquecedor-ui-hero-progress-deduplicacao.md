# Aquecedor — deduplicação hero vs barra de progresso

## Contexto

O usuário reportou redundância na UI do Aquecedor: duas linhas quase iguais exibindo origem → destino realizado e contagem do próximo ciclo (hero + caption da barra).

## Solução

Separar responsabilidades entre os dois elementos:

- **Hero (`#aquecedor-runtime-hero-sub`)**: mostra só o resumo do último evento (ex.: `Envio walkup → 5182006011 realizado.`), removendo o trecho estático `Próximo ciclo em ~Xs` vindo do backend.
- **Barra (`#aquecedor-runtime-progress-caption`)**: mostra só a contagem regressiva ao vivo (ex.: `Próximo ciclo em 138s`) ou mensagens curtas de estado (`Processando envio agora...`, `Aguardando condições para retomar.`).

Função auxiliar `splitAquecedorLastResultMessage()` parseia `lastResult` do backend.

## Arquivos alterados

- `index.html` — `splitAquecedorLastResultMessage`, `renderAquecedorRuntimeProgress`, `renderAquecedorRuntimeHero`

## Como validar

1. Iniciar Aquecedor com ≥2 instâncias conectadas.
2. Após um envio, confirmar:
   - Hero: apenas `Envio origem → destino realizado.`
   - Barra: apenas `Próximo ciclo em Ns` (atualizando a cada tick).
3. Sem repetir a mesma frase completa nos dois lugares.

## Observação (expediente)

Quando `windowOpen === false`, hero exibe uma vez `Retoma automaticamente em {data/hora}.`; barra mostra só `Aguardando próximo expediente.` (sem repetir datetime).
