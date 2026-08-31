# LOG — Seleção de números não restaurar do config salvo

**Data:** 2026-06-21  
**Tipo:** fix  
**Palavras-chave:** disparos, alternativa, seleção números, selectedDisparadorInstances, etapa 1

## Contexto

Na API Alternativa, etapa **1) Seleção de números** abria já com instâncias na coluna «selecionados», herdadas do `GET /disparos/config`. O esperado é lista vazia a cada nova configuração de campanha — o usuário escolhe manualmente.

## Causa

`setDisparosFormValues()` preenchia `pendingSelectedDisparadorInstances` a partir de `config.selectedDisparadorInstances` persistido no servidor após salvamentos anteriores da seção 1.

## Solução

1. `setDisparosFormValues`: sempre `pendingSelectedDisparadorInstances = []` (não restaurar do config).
2. `resetDisparosSectionFlow`: limpa seleção e re-renderiza picker ao reiniciar o fluxo de seções.

Demais campos (expediente, IA, encurtador etc.) continuam carregados do config salvo. A seleção só entra no snapshot ao salvar a seção 1 ou gerar campanha.

## Arquivos

- `index.html`
- `dist/index.html` (build)

## Validar

1. Abrir **Disparos API Alternativa** com config já salva que tinha 4 instâncias.
2. Etapa 1: coluna direita **0 selecionados**; todas em «disponíveis».
3. Selecionar manualmente, salvar seção 1, concluir campanha → após reset, etapa 1 vazia de novo.
