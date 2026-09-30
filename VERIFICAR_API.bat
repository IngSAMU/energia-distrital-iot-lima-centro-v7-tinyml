@echo off
powershell -NoProfile -Command "try { $r=Invoke-RestMethod 'http://localhost:5157/api/health' -TimeoutSec 3; $r ^| ConvertTo-Json } catch { Write-Host 'API NO DISPONIBLE' -ForegroundColor Red; Write-Host $_.Exception.Message }"
pause
