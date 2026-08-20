# Switch-ReadonlyTrial.ps1 —— 版本切换/回滚（SPEC-PLAN 19）
# 用法：
#   Switch-ReadonlyTrial.ps1 -Root C:\ProgramData\WastewaterScada -Version readonly-trial-v0.1.0 [-WhatIf]
#   Switch-ReadonlyTrial.ps1 -Root ... -Rollback [-WhatIf]
# 机制：current.next junction 创建并验证 -> 停服务 -> junction 同卷改名切换 -> 启服务；失败恢复旧 junction。
param(
    [Parameter(Mandatory = $true)][string]$Root,
    [string]$Version,
    [switch]$Rollback,
    [switch]$WhatIf
)

$ErrorActionPreference = 'Stop'
$releases = Join-Path $Root 'releases'
$current = Join-Path $Root 'current'
$currentNext = Join-Path $Root 'current.next'
$serviceName = 'WastewaterScadaReadonly'

function Assert-Condition { param($Condition, $Message)
    if (-not $Condition) { throw "Switch failed: $Message" } }

function Get-JunctionTarget { param($Path)
    (Get-Item $Path -Force).Target | Select-Object -First 1 }

# 解析目标版本目录
if ($Rollback) {
    Assert-Condition (Test-Path $current) 'current junction 不存在，无法回滚'
    $activeTarget = Get-JunctionTarget $current
    $activeName = Split-Path -Leaf $activeTarget
    $candidates = Get-ChildItem $releases -Directory | Where-Object { $_.Name -ne $activeName } | Sort-Object LastWriteTime -Descending
    $target = $candidates | Select-Object -First 1
    Assert-Condition ($null -ne $target) '没有可回滚的其它版本目录'
    Write-Host "回滚：$activeName -> $($target.Name)"
}
else {
    Assert-Condition (-not [string]::IsNullOrWhiteSpace($Version)) '必须提供 -Version 或 -Rollback'
    $target = Get-Item (Join-Path $releases $Version) -ErrorAction SilentlyContinue
    Assert-Condition ($null -ne $target) "版本目录不存在：$releases\$Version"
}

$targetPath = $target.FullName

# 验证目标版本 manifest（SPEC 19：切换前验证 manifest/SHA-256）
$manifestSha = Join-Path $targetPath 'manifest.sha256'
Assert-Condition (Test-Path $manifestSha) "目标版本缺少 manifest.sha256"
if (-not $WhatIf) {
    Push-Location $targetPath
    try {
        $expected = (Get-Content $manifestSha -Raw).Trim() -split "`n" | ForEach-Object {
            if ($_ -match '^([0-9a-fA-F]{64})\s+(.+)$') { [pscustomobject]@{ Hash = $Matches[1]; File = $Matches[2].Trim() } }
        } | Where-Object { $_.File -ne 'manifest.sha256' }
        foreach ($entry in $expected) {
            if (-not (Test-Path $entry.File)) { throw "manifest 文件缺失：$($entry.File)" }
            $actual = (Get-FileHash $entry.File -Algorithm SHA256).Hash.ToLowerInvariant()
            if ($actual -ne $entry.Hash.ToLowerInvariant()) { throw "manifest 哈希不匹配：$($entry.File)" }
        }
        Write-Host "manifest.sha256 验证通过（$($expected.Count) 个文件）"
    }
    finally { Pop-Location }
}

if ($WhatIf) {
    Write-Host "[WhatIf] 将把 current junction 指向：$targetPath（含停/启服务 $serviceName 与失败恢复）"
    return
}

# current.next 创建并验证（先建后切）
if (Test-Path $currentNext) { [System.IO.Directory]::Delete($currentNext, $false) }
New-Item -ItemType Junction -Path $currentNext -Value $targetPath | Out-Null
Assert-Condition (Test-Path (Join-Path $currentNext 'app')) 'current.next 缺少 app 目录'

$serviceExists = [bool](Get-Service -Name $serviceName -ErrorAction SilentlyContinue)
$oldTarget = if (Test-Path $current) { Get-JunctionTarget $current } else { $null }
try {
    if ($serviceExists) { Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue }

    if (Test-Path $current) {
        # 同卷 junction 名称切换：current -> current.old，current.next -> current
        $old = Join-Path $Root 'current.old'
        if (Test-Path $old) { [System.IO.Directory]::Delete($old, $false) }
        Rename-Item $current 'current.old'
        Rename-Item $currentNext 'current'
        [System.IO.Directory]::Delete((Join-Path $Root 'current.old'), $false)
    }
    else {
        Rename-Item $currentNext 'current'
    }

    if ($serviceExists) { Start-Service -Name $serviceName }
    Write-Host "切换完成：current -> $targetPath"
}
catch {
    # 失败恢复旧 junction（SPEC 19）
    Write-Warning "切换失败，恢复旧 junction：$_"
    if (Test-Path $currentNext) { [System.IO.Directory]::Delete($currentNext, $false) }
    if ($oldTarget -and -not (Test-Path $current)) {
        New-Item -ItemType Junction -Path $current -Value $oldTarget | Out-Null
    }
    if ($serviceExists) { Start-Service -Name $serviceName -ErrorAction SilentlyContinue }
    throw
}
