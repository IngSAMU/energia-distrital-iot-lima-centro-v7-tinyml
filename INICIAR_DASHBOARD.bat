@echo off
setlocal
cd /d "%~dp0"
title Energia Distrital IoT - API local

echo ============================================================
echo   ENERGIA DISTRITAL IoT - LIMA CENTRO v0.7
echo ============================================================
echo.

where dotnet >nul 2>nul
if errorlevel 1 (
  echo ERROR: No se encontro dotnet en PATH.
  echo Instale .NET 8 SDK y vuelva a intentarlo.
  pause
  exit /b 1
)

echo Verificando SDK .NET...
dotnet --version
echo.

echo Iniciando API en http://localhost:5157 ...
start "" powershell -NoProfile -WindowStyle Hidden -Command "$u='http://localhost:5157/health'; for($i=0;$i -lt 30;$i++){ try { Invoke-RestMethod -Uri $u -TimeoutSec 1 ^| Out-Null; Start-Process 'http://localhost:5157'; exit 0 } catch { Start-Sleep -Seconds 1 } }; Write-Host 'La API no respondio en 30 segundos.'"

dotnet run --project ".\src\EnergiaDistrital.Api\EnergiaDistrital.Api.csproj" --launch-profile http

echo.
echo La API se ha detenido. Mientras esta ventana este cerrada, el dashboard no podra simular lecturas.
pause
