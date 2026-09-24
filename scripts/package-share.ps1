$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$projectParent = Split-Path $projectRoot -Parent
$projectName = Split-Path $projectRoot -Leaf

if ($projectName -ne 'repromate') { throw "Expected project folder name 'repromate', found '$projectName'." }

Push-Location $projectRoot
try {
  node --test test/*.test.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Automated tests failed; sharing package was not created.' }
  node scripts/setup.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Model or knowledge readiness failed; sharing package was not created.' }
} finally {
  Pop-Location
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$destination = Join-Path $projectParent "ReproMate-AI-share-$stamp.zip"
$items = @(
  "$projectName/.github",
  "$projectName/evaluation",
  "$projectName/knowledge",
  "$projectName/public",
  "$projectName/scripts",
  "$projectName/src",
  "$projectName/test",
  "$projectName/.gitignore",
  "$projectName/package.json",
  "$projectName/README.md",
  "$projectName/SHARE_CHECKLIST.md",
  "$projectName/server.mjs",
  "$projectName/start.ps1"
)

Push-Location $projectParent
try {
  & tar.exe -a -c -f $destination -- @items
  if ($LASTEXITCODE -ne 0) { throw 'ZIP creation failed.' }
} finally {
  Pop-Location
}

Write-Host "Share package created: $destination"
