# 工控机 SCADA 部署配置（管理员 PowerShell 运行）
# 目标：工控机 = 192.168.2.50（网桥管理段汇聚点），同时访问三个网段

$adapter = Get-NetAdapter | Where-Object {$_.Status -eq 'Up' -and $_.InterfaceDescription -match '以太网|Ethernet'} | Select-Object -First 1
if (-not $adapter) { Write-Error "没有找到在线的以太网网卡，请插网线"; exit 1 }
$if = $adapter.ifIndex
Write-Host "网卡: $($adapter.Name) (ifIndex=$if)"

# 三网段地址（已有则跳过）
foreach ($ip in @('192.168.2.50', '192.168.0.60', '192.168.1.50')) {
    $exists = Get-NetIPAddress -InterfaceIndex $if -IPAddress $ip -ErrorAction SilentlyContinue
    if ($exists) { Write-Host "已存在: $ip" } else {
        New-NetIPAddress -InterfaceIndex $if -IPAddress $ip -PrefixLength 24
        Write-Host "已添加: $ip"
    }
}

# 混合池默认 .7 的路由绕过（本机 WLAN 若占 .7）
$routeExists = Get-NetRoute -DestinationPrefix '192.168.0.7/32' -InterfaceIndex $if -ErrorAction SilentlyContinue
if (-not $routeExists) {
    New-NetRoute -DestinationPrefix '192.168.0.7/32' -InterfaceIndex $if -NextHop 0.0.0.0 -RouteMetric 1
    Write-Host "已添加主机路由: 192.168.0.7/32 -> 以太网"
}

Write-Host "`n=== 连通性自测 ==="
foreach ($target in @('192.168.2.66','192.168.2.67','192.168.2.68','192.168.0.8','192.168.0.31','192.168.0.7')) {
    $r = Test-Connection -ComputerName $target -Count 2 -Quiet
    Write-Host "$target : $(if ($r) {'OK'} else {'FAIL'})"
}
