Set-Location -LiteralPath $PSScriptRoot
if (-not $env:OLLAMA_MODEL) { $env:OLLAMA_MODEL = 'llama3.1:8b' }
node server.mjs
