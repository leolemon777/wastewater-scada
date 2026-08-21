# Uninstall-ReadonlyTrial.ps1 —— 仅删除服务登记（SPEC 19：保留配置/日志/releases）。支持 -WhatIf。
param(
    [string]$ServiceName = 'WastewaterScadaReadonly',
    [switch]$WhatIf
)
$ErrorActionPreference = 'Stop'
if ($WhatIf) { Write-Host "[WhatIf] 将停止并删除服务 $ServiceName（保留配置、日志与 releases）"; return }
$service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if (-not $service) { Write-Host "服务 $ServiceName 不存在"; return }
Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
sc.exe delete $ServiceName | Out-Null
Write-Host "服务 $ServiceName 已删除（数据目录未动）"
