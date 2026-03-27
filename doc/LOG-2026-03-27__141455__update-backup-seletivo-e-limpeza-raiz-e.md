# Contexto do pedido

Atualizar a rotina de backup para espelhar no `E:\` somente estas origens:

- `H:\Meu Drive\Drive Profissional`
- `D:\Projeto Bruno LV`
- `D:\Site Credilix`
- `D:\SOMA Promotora`
- `D:\Waba`

Também foi solicitado ajustar a rule no projeto, atualizar a programação do Windows e excluir no `E:\` tudo que não deve permanecer.

## Ações executadas

1. Atualizei a rule `atualize-tudo` para refletir backup seletivo no `E:\`.
2. Atualizei o script de backup em `C:\Scripts\backup-d-para-e.ps1` para:
   - espelhar somente os 5 pares origem/destino permitidos;
   - ignorar stubs Google (`*.gsheet`, `*.gdoc`, etc.) no `robocopy`;
   - registrar logs em `D:\Backup-Logs`;
   - remover automaticamente itens extras na raiz de `E:\` que não pertençam ao escopo permitido.
3. Reconfigurei a tarefa agendada do Windows:
   - `Backup D para E (12h)` apontando para `C:\Scripts\backup-d-para-e.ps1`.
4. Executei limpeza manual complementar no `E:\`:
   - removidos: `E:\Backup-E`, `E:\data`, `E:\found.000`, `E:\elevoc_dnn_kernel.log`.

## Comandos principais executados

- `schtasks /Create /TN "Backup D para E (12h)" /SC DAILY /ST 12:00 /F /TR "powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\Scripts\backup-d-para-e.ps1"`
- `powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\Scripts\backup-d-para-e.ps1`
- Comandos PowerShell para remoção de itens extras em `E:\`.

## Arquivos alterados/criados

- Alterado: `.cursor/rules/atualize-tudo.mdc`
- Alterado: `C:\Scripts\backup-d-para-e.ps1`
- Criado: `doc/LOG-2026-03-27__141455__update-backup-seletivo-e-limpeza-raiz-e.md`

## Resultado atual no `E:\` (raiz)

Permitidos e presentes:

- `Meu Drive`
- `Projeto Bruno LV`
- `Site Credilix`
- `SOMA Promotora`
- `Waba`

Pendências de remoção (bloqueio/permissão em execução):

- `Backup-Logs` (arquivo de log em uso)
- `Meu drive Profissional` (resíduos antigos com erro de acesso em alguns itens)

## Como validar

1. Conferir task:
   - `schtasks /Query /TN "Backup D para E (12h)" /V /FO LIST`
2. Executar backup sob demanda:
   - `powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\Scripts\backup-d-para-e.ps1`
3. Conferir raiz `E:\` e confirmar que somente os diretórios permitidos permanecem (mais entradas de sistema).

## Observações de segurança

- Nenhum segredo/chave foi incluído em código, logs versionados ou documentação.
- A rotina mantém espelhamento por `robocopy /MIR` apenas para destinos explícitos.

## Itens para evitar duplicação no futuro (palavras-chave)

- backup-seletivo-e
- espelho-d-para-e
- robocopy-mir-multiplas-origens
- limpeza-raiz-e
- schtasks-backup-d-para-e
