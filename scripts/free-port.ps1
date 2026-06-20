param(
  [Parameter(Mandatory = $true)]
  [int]$Port
)

Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object {
    $p = $_.OwningProcess
    if ($p -gt 0) {
      Write-Host "Encerrando PID $p (porta $Port)..."
      Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
    }
  }
