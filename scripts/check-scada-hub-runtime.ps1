$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Net.Http

function Assert-Condition {
    param(
        [Parameter(Mandatory = $true)]
        [bool]$Condition,
        [Parameter(Mandatory = $true)]
        [string]$Message
    )

    if (-not $Condition) {
        throw "SCADA Hub runtime assertion failed: $Message"
    }
}

function Receive-WebSocketText {
    param(
        [Parameter(Mandatory = $true)]
        [System.Net.WebSockets.ClientWebSocket]$Socket
    )

    $buffer = New-Object byte[] 65536
    $segment = New-Object 'System.ArraySegment[byte]' -ArgumentList (, $buffer)
    $builder = New-Object System.Text.StringBuilder

    do {
        $result = $Socket.ReceiveAsync($segment, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
        if ($result.MessageType -eq [Net.WebSockets.WebSocketMessageType]::Close) {
            throw "WebSocket closed before the initial snapshot: $($result.CloseStatus) $($result.CloseStatusDescription)"
        }

        [void]$builder.Append([Text.Encoding]::UTF8.GetString($buffer, 0, $result.Count))
    } while (-not $result.EndOfMessage)

    return $builder.ToString()
}

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$serviceRoot = Join-Path $repositoryRoot 'services\ScadaHub'
$hubAssembly = Join-Path $serviceRoot 'bin\Debug\net8.0\ScadaHub.dll'
$x64Dotnet = Join-Path $env:ProgramFiles 'dotnet\dotnet.exe'

if (-not (Test-Path -LiteralPath $hubAssembly)) {
    throw 'SCADA Hub build output is missing. Run npm run hub:test first.'
}

$listener = New-Object Net.Sockets.TcpListener([Net.IPAddress]::Loopback, 0)
$listener.Start()
$port = ([Net.IPEndPoint]$listener.LocalEndpoint).Port
$listener.Stop()

$baseUrl = "http://127.0.0.1:$port"
$webSocketUrl = "ws://127.0.0.1:$port/ws/scada"
$stdoutPath = [IO.Path]::GetTempFileName()
$stderrPath = [IO.Path]::GetTempFileName()
$hubProcess = $null
$httpClient = $null

try {
    $arguments = "`"$hubAssembly`" --urls $baseUrl"
    $hubProcess = Start-Process `
        -FilePath $x64Dotnet `
        -ArgumentList $arguments `
        -WorkingDirectory $serviceRoot `
        -WindowStyle Hidden `
        -RedirectStandardOutput $stdoutPath `
        -RedirectStandardError $stderrPath `
        -PassThru

    $httpClient = New-Object Net.Http.HttpClient
    $health = $null
    $deadline = [DateTime]::UtcNow.AddSeconds(15)
    do {
        try {
            $healthJson = $httpClient.GetStringAsync("$baseUrl/api/health").GetAwaiter().GetResult()
            $health = $healthJson | ConvertFrom-Json
        }
        catch {
            if ($hubProcess.HasExited) {
                throw "SCADA Hub exited before becoming ready with code $($hubProcess.ExitCode)."
            }

            Start-Sleep -Milliseconds 100
        }
    } while ($null -eq $health -and [DateTime]::UtcNow -lt $deadline)

    Assert-Condition ($null -ne $health) 'health endpoint did not become ready within 15 seconds'
    Assert-Condition ($health.status -eq 'ok') 'health status must be ok'
    Assert-Condition ($health.service -eq 'scada-hub') 'health service name must be scada-hub'
    Assert-Condition ($health.readOnly -eq $true) 'health endpoint must explicitly report readOnly=true'
    Assert-Condition ($health.pureWaterPlc.enabled -eq $false) 'default PLC adapter must remain disabled'
    Assert-Condition ($health.pureWaterPlc.connected -eq $false) 'disabled adapter must not claim a connection'

    $snapshotJson = $httpClient.GetStringAsync("$baseUrl/api/pure-water/plc/snapshot").GetAwaiter().GetResult()
    $snapshot = $snapshotJson | ConvertFrom-Json
    Assert-Condition ($snapshot.schema -eq 'scada.v1') 'snapshot schema must be scada.v1'
    Assert-Condition ($snapshot.messageType -eq 'purewater.plc.snapshot') 'snapshot message type mismatch'
    Assert-Condition ($snapshot.sourceId -eq 'purewater-plc-01') 'snapshot source ID mismatch'
    Assert-Condition ($snapshot.payload.enabled -eq $false) 'snapshot must identify an intentionally disabled adapter'
    Assert-Condition ($snapshot.payload.connected -eq $false) 'snapshot must not fabricate a PLC connection'
    Assert-Condition ($snapshot.payload.sequence -eq 0) 'disabled adapter sequence must remain zero'
    Assert-Condition ($null -ne $snapshot.payload.rawWords) 'snapshot payload must expose rawWords for diagnostic traceability'

    $statusJson = $httpClient.GetStringAsync("$baseUrl/api/pure-water/plc/status").GetAwaiter().GetResult()
    $status = $statusJson | ConvertFrom-Json
    Assert-Condition ($status.enabled -eq $false) 'status endpoint enabled flag mismatch'
    Assert-Condition ($status.connected -eq $false) 'status endpoint connection flag mismatch'

    $emptyContent = New-Object Net.Http.StringContent('')
    $postResponse = $httpClient.PostAsync("$baseUrl/api/pure-water/plc/snapshot", $emptyContent).GetAwaiter().GetResult()
    Assert-Condition ([int]$postResponse.StatusCode -eq 405) 'PLC API must reject POST with HTTP 405'
    $postResponse.Dispose()
    $emptyContent.Dispose()

    $socket = New-Object Net.WebSockets.ClientWebSocket
    try {
        [void]$socket.ConnectAsync([Uri]$webSocketUrl, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
        $initialText = Receive-WebSocketText -Socket $socket
        $initial = $initialText | ConvertFrom-Json
        Assert-Condition ($initial.messageType -eq 'purewater.plc.snapshot') 'WebSocket must send the current snapshot first'
        Assert-Condition ($initial.payload.enabled -eq $false) 'WebSocket initial snapshot must preserve disabled state'

        $commandBytes = [Text.Encoding]::UTF8.GetBytes('{}')
        $commandSegment = New-Object 'System.ArraySegment[byte]' -ArgumentList (, $commandBytes)
        [void]$socket.SendAsync(
            $commandSegment,
            [Net.WebSockets.WebSocketMessageType]::Text,
            $true,
            [Threading.CancellationToken]::None
        ).GetAwaiter().GetResult()

        $closeBuffer = New-Object byte[] 1024
        $closeSegment = New-Object 'System.ArraySegment[byte]' -ArgumentList (, $closeBuffer)
        $closeResult = $socket.ReceiveAsync($closeSegment, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
        Assert-Condition ($closeResult.MessageType -eq [Net.WebSockets.WebSocketMessageType]::Close) 'client command must close the read-only WebSocket'
        Assert-Condition ($closeResult.CloseStatus -eq [Net.WebSockets.WebSocketCloseStatus]::PolicyViolation) 'client command must close with policy violation'
    }
    finally {
        $socket.Dispose()
    }

    $forbiddenSocket = New-Object Net.WebSockets.ClientWebSocket
    $forbiddenOriginRejected = $false
    try {
        $forbiddenSocket.Options.SetRequestHeader('Origin', 'http://example.com')
        try {
            [void]$forbiddenSocket.ConnectAsync([Uri]$webSocketUrl, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
        }
        catch {
            $forbiddenOriginRejected = $true
        }
    }
    finally {
        $forbiddenSocket.Dispose()
    }
    Assert-Condition $forbiddenOriginRejected 'non-loopback WebSocket Origin must be rejected'

    Write-Output "SCADA Hub runtime: REST=OK, WebSocket=OK, read-only rejection=OK, origin guard=OK, port=$port"
}
catch {
    Write-Error $_
    if (Test-Path -LiteralPath $stdoutPath) {
        Write-Output 'SCADA Hub stdout:'
        Get-Content -LiteralPath $stdoutPath
    }
    if (Test-Path -LiteralPath $stderrPath) {
        Write-Output 'SCADA Hub stderr:'
        Get-Content -LiteralPath $stderrPath
    }
    throw
}
finally {
    if ($null -ne $httpClient) {
        $httpClient.Dispose()
    }

    if ($null -ne $hubProcess -and -not $hubProcess.HasExited) {
        Stop-Process -Id $hubProcess.Id
        [void]$hubProcess.WaitForExit(5000)
    }

    foreach ($temporaryPath in @($stdoutPath, $stderrPath)) {
        if (Test-Path -LiteralPath $temporaryPath) {
            Remove-Item -LiteralPath $temporaryPath -Force
        }
    }
}
