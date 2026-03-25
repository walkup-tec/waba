## Contexto

Atualizar a rule do projeto para que, ao pedir **“Atualize tudo”**, a execução inclua também a rotina de **backup espelho fiel** dos projetos:

- **Origem (matriz)**: `E:\`
- **Destino (espelho)**: `D:\Backup-E\`
- **Agendamento**: diário às **12:00** (Task Scheduler)
- **Execução manual**: permitir rodar o backup imediatamente

## Ações executadas

- Atualizada a rule `.cursor/rules/atualize-tudo.mdc` para incluir a etapa de backup e os comandos relacionados.
- Removido arquivo residual `query` (não deveria entrar no repositório).

## Rotina (referência)

### Script

Salvar/atualizar em `C:\Scripts\backup-e-para-d.ps1`:

```powershell
$source = "E:\"
$destRoot = "D:\Backup-E"
$logDir = "D:\Backup-Logs"

New-Item -ItemType Directory -Force -Path $destRoot | Out-Null
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$stamp = Get-Date -Format "yyyy-MM-dd__HHmmss"
$log = Join-Path $logDir "backup_E_para_D_$stamp.log"

robocopy $source $destRoot /MIR /R:2 /W:5 /XJ /FFT /Z /NP /TEE /LOG:$log
exit $LASTEXITCODE
```

### Agendamento (Task Scheduler)

CMD/PowerShell (idealmente elevado):

```bash
schtasks /Create /TN "Backup E para D (12h)" /SC DAILY /ST 12:00 /RL HIGHEST /F /TR "powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\Scripts\backup-e-para-d.ps1"
```

### Executar agora

```bash
powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\Scripts\backup-e-para-d.ps1
```

## Arquivos alterados/criados

- **Alterado**: `.cursor/rules/atualize-tudo.mdc`
- **Criado**: `doc/LOG-2026-03-25__115922__rule-atualize-tudo-backup-e-para-d.md`

## Como validar

- Rodar “Atualize tudo” e verificar que o backup é executado antes do build.
- Verificar logs em `D:\Backup-Logs\`.

## Observações

- O espelho fiel usa `/MIR`, então deleções em `E:\` são refletidas em `D:\Backup-E\`.

## Palavras-chave

- atualize-tudo
- backup
- robocopy
- schtasks
- espelho fiel
- E para D

