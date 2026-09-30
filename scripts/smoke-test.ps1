[CmdletBinding()]
param(
    [Parameter()]
    [string] $Project = (Join-Path $PSScriptRoot "..\src\EnergiaDistrital.Api\EnergiaDistrital.Api.csproj"),

    [Parameter()]
    [ValidatePattern('^https?://')]
    [string] $BaseUrl = "http://127.0.0.1:5157",

    [Parameter()]
    [ValidateRange(5, 300)]
    [int] $StartupTimeoutSeconds = 45,

    [Parameter()]
    [switch] $SkipBuild
)

$ErrorActionPreference = "Stop"
$BaseUrl = $BaseUrl.TrimEnd('/')
$projectPath = (Resolve-Path -LiteralPath $Project).Path
$projectDirectory = Split-Path -Parent $projectPath
$serverProcess = $null

function Invoke-JsonEndpoint {
    param(
        [Parameter(Mandatory)]
        [ValidateSet("GET", "POST")]
        [string] $Method,

        [Parameter(Mandatory)]
        [string] $Path
    )

    $request = @{
        Uri         = "$BaseUrl$Path"
        Method      = $Method
        TimeoutSec  = 10
        ErrorAction = "Stop"
    }

    if ($Method -eq "POST") {
        $request.ContentType = "application/json"
        $request.Body = "{}"
    }

    $response = Invoke-WebRequest @request -UseBasicParsing
    if ([int] $response.StatusCode -lt 200 -or [int] $response.StatusCode -ge 300) {
        throw "$Method $Path respondió HTTP $($response.StatusCode)."
    }

    try {
        $result = $response.Content | ConvertFrom-Json
    }
    catch {
        throw "$Method $Path no devolvió JSON válido. $($_.Exception.Message)"
    }

    Write-Host "[OK] $Method $Path -> HTTP $($response.StatusCode)" -ForegroundColor Green
    return $result
}

try {
    if (-not $SkipBuild) {
        Write-Host "Compilando $projectPath ..."
        & dotnet build $projectPath --configuration Release
        if ($LASTEXITCODE -ne 0) {
            throw "La compilación terminó con código $LASTEXITCODE."
        }
    }

    $arguments = @(
        "run"
        "--project"
        "`"$projectPath`""
        "--configuration"
        "Release"
        "--no-build"
        "--no-launch-profile"
        "--"
        "--urls"
        $BaseUrl
    )

    Write-Host "Iniciando servidor temporal en $BaseUrl ..."
    $serverProcess = Start-Process `
        -FilePath "dotnet" `
        -ArgumentList $arguments `
        -WorkingDirectory $projectDirectory `
        -PassThru `
        -NoNewWindow

    $deadline = [DateTime]::UtcNow.AddSeconds($StartupTimeoutSeconds)
    $healthy = $false

    while ([DateTime]::UtcNow -lt $deadline) {
        $serverProcess.Refresh()
        if ($serverProcess.HasExited) {
            throw "El servidor terminó antes de responder. Código: $($serverProcess.ExitCode)."
        }

        try {
            $health = Invoke-WebRequest `
                -Uri "$BaseUrl/health" `
                -Method Get `
                -TimeoutSec 2 `
                -UseBasicParsing `
                -ErrorAction Stop

            if ([int] $health.StatusCode -ge 200 -and [int] $health.StatusCode -lt 300) {
                $healthy = $true
                break
            }
        }
        catch {
            Start-Sleep -Milliseconds 500
        }
    }

    if (-not $healthy) {
        throw "La aplicación no estuvo lista en $StartupTimeoutSeconds segundos."
    }

    Write-Host "[OK] GET /health" -ForegroundColor Green

    $dashboard = Invoke-JsonEndpoint -Method GET -Path "/api/dashboard"
    foreach ($requiredProperty in @("district", "generatedAtUtc", "kpis", "consumptionByZone", "demandTrend", "recentAlerts")) {
        if ($dashboard.PSObject.Properties.Name -notcontains $requiredProperty) {
            throw "GET /api/dashboard no contiene la propiedad '$requiredProperty'."
        }
    }

    $null = Invoke-JsonEndpoint -Method GET -Path "/api/zones"
    $null = Invoke-JsonEndpoint -Method GET -Path "/api/meters"
    $map = Invoke-JsonEndpoint -Method GET -Path "/api/map"
    foreach ($requiredProperty in @("district", "generatedAtUtc", "viewport", "zones", "meters", "facilities")) {
        if ($map.PSObject.Properties.Name -notcontains $requiredProperty) {
            throw "GET /api/map no contiene la propiedad '$requiredProperty'."
        }
    }
    $infrastructure = Invoke-JsonEndpoint -Method GET -Path "/api/infrastructure"
    if ($null -eq $infrastructure -or @($infrastructure).Count -lt 1) {
        throw "GET /api/infrastructure no devolvió establecimientos."
    }
    $null = Invoke-JsonEndpoint -Method GET -Path "/api/readings?limit=5"
    $null = Invoke-JsonEndpoint -Method GET -Path "/api/alerts"
    $null = Invoke-JsonEndpoint -Method POST -Path "/api/simulator/tick"

    Write-Host "Prueba de humo completada correctamente." -ForegroundColor Cyan
}
finally {
    if ($null -ne $serverProcess) {
        $serverProcess.Refresh()
        if (-not $serverProcess.HasExited) {
            Write-Host "Deteniendo servidor temporal ..."
            $isWindowsPlatform = [System.Environment]::OSVersion.Platform -eq [System.PlatformID]::Win32NT

            if ($isWindowsPlatform) {
                & taskkill.exe /PID $serverProcess.Id /T /F 2>$null | Out-Null
            }
            else {
                Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue
            }
        }

        $serverProcess.Dispose()
    }
}
