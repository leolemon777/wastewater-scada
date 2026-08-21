# Install-ReadonlyTrial.ps1 —— Windows 服务安装（SPEC-PLAN 19）
# 服务名固定 WastewaterScadaReadonly；虚拟服务账户 NT SERVICE\...；恢复策略 5s/15s/停止告警。
# 支持 -WhatIf。默认读取 <Root>\current（junction 指向 releases\<version>）。
param(
    [Parameter(Mandatory = $true)][string]$Root,
    [switch]$WhatIf
)

$ErrorActionPreference = 'Stop'
$serviceName = 'WastewaterScadaReadonly'
$current = Join-Path $Root 'current'
$exe = Join-Path $current 'app\ScadaHub.exe'
$logsDir = Join-Path $Root 'logs'
$configDir = Join-Path $Root 'config'

if (-not (Test-Path $exe)) { throw "未找到 $exe（先运行 Switch-ReadonlyTrial 指向有效版本）" }
if ($WhatIf) {
    Write-Host "[WhatIf] 将创建服务 $serviceName（ImagePath=$exe，虚拟服务账户，Delayed Auto，恢复 5s/15s/停止）"
    Write-Host "[WhatIf] 目录：logs=$logsDir config=$configDir（config 仅服务账户/Administrators 可读）"
    return
}

if (Get-Service -Name $serviceName -ErrorAction SilentlyContinue) {
    throw "服务 $serviceName 已存在（先 Uninstall）"
}

New-Item -ItemType Directory -Force -Path $logsDir, $configDir | Out-Null

# 示例配置（无凭据；真实配置由现场放入 config\appsettings.local.json 并收紧 ACL）
$exampleConfig = @'
{
  "M100": {
    "Enabled": true,
    "Devices": [
      { "Enabled": false, "SourceId": "m100-daf-01", "Role": "daf", "IpAddress": "192.168.0.31" },
      { "Enabled": false, "SourceId": "m100-underground-01", "Role": "underground", "IpAddress": "192.168.0.8" }
    ]
  },
  "PureWaterPlc": { "Enabled": false }
}
'@
$examplePath = Join-Path $configDir 'appsettings.local.example.json'
if (-not (Test-Path $examplePath)) { Set-Content -Path $examplePath -Value $exampleConfig -Encoding UTF8 }

# 目录 ACL（SPEC 11.3）：releases/config 只读继承；logs 服务账户可写。
$serviceAccount = "NT SERVICE\$serviceName"
$grant = "{0}:(OI)(CI)M" -f $serviceAccount
icacls $logsDir /grant $grant | Out-Null

sc.exe create $serviceName binPath= "`"$exe`"" start= delayed-auto obj= $serviceAccount | Out-Null
sc.exe failure $serviceName reset= 86400 actions= restart/5000/restart/15000/ | Out-Null
sc.exe description $serviceName 'Wastewater SCADA readonly-trial Hub (monitor only)' | Out-Null

Write-Host "服务已创建。首次启动为全部 IO 禁用（现场按 WP8 逐台启用设备）。"
Write-Host "启动：Start-Service $serviceName"
