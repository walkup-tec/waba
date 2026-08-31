# Libera a porta 3000 encerrando o processo que estiver em LISTENING (Windows / PowerShell).
Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object {
    $p = $_.OwningProcess
    if ($p -gt 0) {
      Write-Host "Encerrando PID $p (porta 3000)..."
      Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
    }
  }
