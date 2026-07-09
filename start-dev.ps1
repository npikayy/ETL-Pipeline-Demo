$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
$backendDir = Join-Path $root "backend"
$frontendDir = Join-Path $root "frontend"
$python = Join-Path $root "venv\Scripts\python.exe"
$credentials = Join-Path $backendDir "credentials.json"

if (-not (Test-Path -LiteralPath $python)) {
    throw "Virtual environment not found at: $python"
}

if (-not (Test-Path -LiteralPath $credentials)) {
    throw "Google Cloud credentials were not found at: $credentials"
}

if (-not (Test-Path -LiteralPath (Join-Path $frontendDir "package.json"))) {
    throw "Frontend package.json was not found."
}

if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    throw "npm was not found. Install Node.js and ensure npm is available in PATH."
}

$env:GOOGLE_APPLICATION_CREDENTIALS = $credentials

Write-Host "Starting backend at http://localhost:8000 ..."
$backendProcess = Start-Process $python -NoNewWindow -PassThru -WorkingDirectory $backendDir -ArgumentList @(
    "-m", "uvicorn", "app:app",
    "--host", "0.0.0.0",
    "--port", "8000",
    "--reload"
)

Write-Host "Starting frontend at http://localhost:3000 ..."
$frontendProcess = Start-Process npm.cmd -NoNewWindow -PassThru -WorkingDirectory $frontendDir -ArgumentList "start"

Write-Host ""
Write-Host "Development services started in this terminal. Press Ctrl+C to stop both."

try {
    while (-not $backendProcess.HasExited -and -not $frontendProcess.HasExited) {
        Start-Sleep -Milliseconds 500
        $backendProcess.Refresh()
        $frontendProcess.Refresh()
    }
}
finally {
    foreach ($process in @($backendProcess, $frontendProcess)) {
        if ($process -and -not $process.HasExited) {
            Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
        }
    }

    Write-Host "Development services stopped."
}
