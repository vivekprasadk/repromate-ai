$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Install Node.js 20+ and reopen this launcher.' }
$nodeMajor = [int](node -p "process.versions.node.split('.')[0]")
if ($nodeMajor -lt 20) { throw 'ReproMate requires Node.js 20 or newer. Update Node.js and reopen this launcher.' }
if (-not $env:OLLAMA_MODEL) { $env:OLLAMA_MODEL = 'qwen3-vl:4b-instruct-q4_K_M' }
node scripts/setup.mjs
if ($LASTEXITCODE -ne 0) { Write-Warning 'AI is not ready. Follow the setup error above. The deterministic demo remains available; startup never downloads weights.' }
$port = if ($env:PORT) { $env:PORT } else { '4317' }
$url = "http://127.0.0.1:$port"
try { $existing = Invoke-RestMethod "$url/api/status" -TimeoutSec 2 } catch { $existing = $null }
if ($existing -and ($existing.app -ne 'repromate' -or $existing.apiVersion -ne 3)) { throw 'Another application or an older ReproMate is using this port. Stop it manually or set PORT to a free port.' }
if (-not $existing) {
  New-Item -ItemType Directory -Path '.runtime' -Force | Out-Null
  $process = Start-Process -FilePath (Get-Command node).Source -ArgumentList 'server.mjs' -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput '.runtime/server.log' -RedirectStandardError '.runtime/server-error.log'
  Set-Content -LiteralPath '.runtime/server.pid' -Value $process.Id
  $ready = $false
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    Start-Sleep -Milliseconds 500
    $process.Refresh()
    if ($process.HasExited) { throw 'Service failed. Read .runtime/server-error.log; the port may already be occupied.' }
    try { Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 3 | Out-Null; $ready = $true; break } catch {}
  }
  if (-not $ready) { throw 'Startup health check timed out. Read .runtime/server-error.log. The launched process ID is in .runtime/server.pid.' }
}
Write-Host "ReproMate: $url. Closing the browser does not stop the local service."
Start-Process $url
