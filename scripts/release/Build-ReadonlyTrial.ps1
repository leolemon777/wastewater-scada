# Build-ReadonlyTrial.ps1 —— 发布流水线（SPEC-PLAN 20 骨架，WP5 只实现机制不产出最终签核包）
# 顺序：工作树检查 -> 工具 -> npm ci -> check:scene -> test:store -> build -> lint -> dotnet test
#       -> dotnet publish(self-contained) -> dist->wwwroot -> 敏感扫描 -> version.json -> manifest.sha256
# 任一步失败即中止，不生成"可部署"标记。
param(
    [string]$Version = "readonly-trial-v0.1.0-dev",
    [string]$OutputRoot = ".\release-staging"
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

# x64 SDK 优先（本机可能同时存在 x86 dotnet 且 PATH 次序不利）。
$x64Dotnet = Join-Path $env:ProgramFiles 'dotnet'
if (Test-Path (Join-Path $x64Dotnet 'dotnet.exe')) {
    $env:PATH = "$x64Dotnet;$env:PATH"
}
Push-Location $repo
try {
    function Step { param($Name)
        Write-Host "`n=== $Name ===" -ForegroundColor Cyan }

    # 1. 工作树检查（允许 dirty 但必须显式记录 commit）
    $commit = (git rev-parse HEAD).Trim()
    $dirty = -not [string]::IsNullOrEmpty((git status --porcelain))
    Write-Host "commit=$commit dirty=$dirty"

    Step "工具版本核对"
    $nodeVersion = (node --version).Trim()
    Write-Host "node=$nodeVersion npm=$(npm --version) dotnet=$(dotnet --version)"

    Step "npm ci（锁定依赖）"
    npm ci
    if ($LASTEXITCODE -ne 0) { throw "npm ci failed" }

    Step "npm run check:scene"
    npm run check:scene; if ($LASTEXITCODE -ne 0) { throw "check:scene failed" }

    Step "npm run test:store"
    npm run test:store; if ($LASTEXITCODE -ne 0) { throw "test:store failed" }

    Step "npm run build"
    npm run build; if ($LASTEXITCODE -ne 0) { throw "build failed" }

    Step "npm run lint"
    npm run lint; if ($LASTEXITCODE -ne 0) { throw "lint failed" }

    Step "npm run check:secrets"
    npm run check:secrets; if ($LASTEXITCODE -ne 0) { throw "check:secrets failed" }

    Step "dotnet test（locked restore）"
    dotnet test tests/ScadaHub.Tests/ScadaHub.Tests.csproj -c Debug --nologo
    if ($LASTEXITCODE -ne 0) { throw "dotnet test failed" }

    Step "dotnet publish（win-x64 self-contained）"
    $publishDir = Join-Path $OutputRoot "$Version\app"
    dotnet publish services/ScadaHub/ScadaHub.csproj -c Release -r win-x64 --self-contained true -o $publishDir --nologo
    if ($LASTEXITCODE -ne 0) { throw "dotnet publish failed" }

    Step "dist -> wwwroot"
    $wwwroot = Join-Path $publishDir 'wwwroot'
    New-Item -ItemType Directory -Force -Path $wwwroot | Out-Null
    Copy-Item -Path .\dist\* -Destination $wwwroot -Recurse -Force

    Step "排除检查：发布目录不含 local 配置"
    $localLeak = Get-ChildItem $publishDir -Recurse -Filter 'appsettings.local.json' -ErrorAction SilentlyContinue
    if ($localLeak) { throw "发布目录包含 appsettings.local.json：$($localLeak.FullName)" }

    Step "version.json"
    $versionJson = @{
        version = $Version
        commit = $commit
        dirty = $dirty
        builtAt = (Get-Date).ToUniversalTime().ToString('o')
        supportedSourceIds = @('m100-daf-01', 'm100-underground-01')
        readOnly = $true
        pureWaterPlcEnabled = $false
    } | ConvertTo-Json
    Set-Content -Path (Join-Path $OutputRoot "$Version\version.json") -Value $versionJson -Encoding UTF8

    Step "config 示例（无凭据）"
    New-Item -ItemType Directory -Force -Path (Join-Path $OutputRoot "$Version\config") | Out-Null
    Copy-Item services/ScadaHub/appsettings.local.example.json -Destination (Join-Path $OutputRoot "$Version\config\appsettings.local.example.json")

    Step "manifest.sha256"
    $packageDir = Join-Path $OutputRoot $Version
    Push-Location $packageDir
    try {
        $lines = Get-ChildItem -Recurse -File | ForEach-Object {
            $relative = $_.FullName.Substring((Get-Location).Path.Length + 1) -replace '\\', '/'
            $hash = (Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
            "$hash  $relative"
        }
        Set-Content -Path .\manifest.sha256 -Value ($lines -join "`r`n") -Encoding UTF8
        Write-Host "manifest 覆盖 $($lines.Count) 个文件"
    }
    finally { Pop-Location }

    Write-Host "`n发布包就绪（非最终签核包，SPEC WP5）：$packageDir" -ForegroundColor Green
    Write-Host "安装：Switch-ReadonlyTrial.ps1 -Version $Version -> Install-ReadonlyTrial.ps1"
}
finally { Pop-Location }
