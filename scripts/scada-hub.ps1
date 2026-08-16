param(
    [Parameter(Position = 0)]
    [ValidateSet('restore', 'build', 'test', 'run')]
    [string]$Action = 'run'
)

$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$solutionPath = Join-Path $repositoryRoot 'ScadaHub.slnx'
$projectPath = Join-Path $repositoryRoot 'services\ScadaHub\ScadaHub.csproj'
$x64Dotnet = Join-Path $env:ProgramFiles 'dotnet\dotnet.exe'

if (-not (Test-Path -LiteralPath $x64Dotnet)) {
    throw "64-bit .NET SDK was not found at $x64Dotnet"
}

Push-Location $repositoryRoot
try {
    switch ($Action) {
        'restore' {
            & $x64Dotnet restore $solutionPath --nologo
        }
        'build' {
            & $x64Dotnet build $solutionPath --nologo
        }
        'test' {
            & $x64Dotnet test $solutionPath --nologo
        }
        'run' {
            & $x64Dotnet run --project $projectPath --no-launch-profile
        }
    }

    if ($LASTEXITCODE -ne 0) {
        throw "SCADA Hub '$Action' failed with exit code $LASTEXITCODE."
    }
}
finally {
    Pop-Location
}
