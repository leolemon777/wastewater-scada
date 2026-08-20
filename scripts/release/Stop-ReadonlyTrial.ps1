param([string]$ServiceName = 'WastewaterScadaReadonly')
$ErrorActionPreference = 'Stop'
Stop-Service -Name $ServiceName -Force
Write-Host "服务已停止"
