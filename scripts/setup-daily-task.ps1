<#
.SYNOPSIS
  Configura una tarea programada en Windows para ejecutar la publicación y actualización
  automática de Santa Cruz Noticias todos los días al iniciar sesión o cada 30 minutos.
#>

param(
  [string]$Action = "install"
)

$TaskName = "SantaCruzNoticias-DailyService"
$ProjectPath = Resolve-Path "$PSScriptRoot\.."
$NodeExe = (Get-Command node -ErrorAction SilentlyContinue)?.Source

if (-not $NodeExe) {
  # Buscar en ubicaciones comunes de WinGet / Program Files
  $wingetPath = Get-ChildItem -Path "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Filter "node.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
  if ($wingetPath) {
    $NodeExe = $wingetPath
  } elseif (Test-Path "C:\Program Files\nodejs\node.exe") {
    $NodeExe = "C:\Program Files\nodejs\node.exe"
  } else {
    Write-Error "No se encontró el ejecutable de Node.js en el sistema."
    exit 1
  }
}

if ($Action -eq "uninstall") {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host "Tarea '$TaskName' eliminada exitosamente."
  exit 0
}

Write-Host "Configurando tarea diaria de Santa Cruz Noticias..."
Write-Host "  Node: $NodeExe"
Write-Host "  Ruta del proyecto: $ProjectPath"

$ActionObj = New-ScheduledTaskAction -Execute $NodeExe -Argument "server/index.js" -WorkingDirectory $ProjectPath
$TriggerLogon = New-ScheduledTaskTrigger -AtLogOn
$TriggerDaily = New-ScheduledTaskTrigger -Daily -At "07:00"
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 5)

Register-ScheduledTask -TaskName $TaskName -Action $ActionObj -Trigger @($TriggerLogon, $TriggerDaily) -Settings $Settings -Description "Actualización y publicación diaria automática de Santa Cruz Noticias" -Force

Write-Host ""
Write-Host "¡Tarea programada '$TaskName' creada con éxito!"
Write-Host "Las noticias se publicarán automáticamente todos los días."
Write-Host "Para eliminar la tarea: .\scripts\setup-daily-task.ps1 -Action uninstall"
