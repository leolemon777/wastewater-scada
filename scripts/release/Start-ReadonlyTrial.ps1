param([string]$ServiceName = 'WastewaterScadaReadonly')
$ErrorActionPreference = 'Stop'
Start-Service -Name $ServiceName
Write-Host "服务已启动；健康检查：http://127.0.0.1:18080/api/health/live"
