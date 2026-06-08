# Deploy Cloudflare Push Worker (requires CLOUDFLARE_API_TOKEN or interactive wrangler login)
# Usage:
#   $env:WEB_PUSH_PRIVATE_KEY = "your_private_key"
#   $env:CLOUDFLARE_API_TOKEN = "your_token"   # optional if already logged in via wrangler login
#   .\scripts\deploy-push-worker.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$WranglerConfig = Join-Path $Root "workers\push\wrangler.toml"
$EnvLocal = Join-Path $Root ".env.local"

Set-Location $Root

function Get-TomlValue([string]$Key) {
  $line = Get-Content $WranglerConfig | Where-Object { $_ -match "^\s*$Key\s*=" } | Select-Object -First 1
  if (-not $line) { return $null }
  return ($line -split '=', 2)[1].Trim().Trim('"')
}

$publicKey = Get-TomlValue "WEB_PUSH_PUBLIC_KEY"
if (-not $publicKey -or $publicKey -like "REPLACE_*") {
  Write-Error "Set WEB_PUSH_PUBLIC_KEY in workers/push/wrangler.toml first (npx web-push generate-vapid-keys --json)."
}

$secretsFile = Join-Path $Root ".env.push.local"
if (-not $env:WEB_PUSH_PRIVATE_KEY -and (Test-Path $secretsFile)) {
  Get-Content $secretsFile | ForEach-Object {
    if ($_ -match '^\s*WEB_PUSH_PRIVATE_KEY\s*=\s*"?([^"#]+)"?\s*$') {
      $env:WEB_PUSH_PRIVATE_KEY = $Matches[1].Trim()
    }
  }
}
$privateKey = $env:WEB_PUSH_PRIVATE_KEY
if (-not $privateKey) {
  $privateKey = Read-Host "WEB_PUSH_PRIVATE_KEY (VAPID private key, not stored in repo)"
}
if (-not $privateKey) { Write-Error "WEB_PUSH_PRIVATE_KEY is required." }

$toml = Get-Content $WranglerConfig -Raw
if ($toml -match "REPLACE_WITH_KV_NAMESPACE_ID") {
  Write-Host "Creating KV namespace PUSH_SUBSCRIPTIONS..."
  $kvOut = npx wrangler kv namespace create PUSH_SUBSCRIPTIONS --config $WranglerConfig 2>&1 | Out-String
  Write-Host $kvOut
  if ($kvOut -notmatch 'id = "([^"]+)"') {
    Write-Error "Could not parse KV namespace id. Run: npx wrangler kv namespace create PUSH_SUBSCRIPTIONS --config workers/push/wrangler.toml"
  }
  $kvId = $Matches[1]
  $toml = $toml -replace "REPLACE_WITH_KV_NAMESPACE_ID", $kvId
  Set-Content -Path $WranglerConfig -Value $toml -NoNewline
  Write-Host "Updated wrangler.toml with KV id: $kvId"
}

Write-Host "Setting WEB_PUSH_PRIVATE_KEY secret..."
$privateKey | npx wrangler secret put WEB_PUSH_PRIVATE_KEY --config $WranglerConfig

Write-Host "Deploying worker..."
$deployOut = npx wrangler deploy --config $WranglerConfig 2>&1 | Out-String
Write-Host $deployOut

$workerUrl = $null
if ($deployOut -match '(https://[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev)') {
  $workerUrl = $Matches[1]
}
if (-not $workerUrl) {
  $workerUrl = Read-Host "Worker URL (from deploy output)"
}

$envLines = @(
  "VITE_PUSH_WORKER_URL=`"$workerUrl`"",
  "VITE_WEB_PUSH_PUBLIC_KEY=`"$publicKey`""
)
if (Test-Path $EnvLocal) {
  $existing = Get-Content $EnvLocal
  $filtered = $existing | Where-Object {
    $_ -notmatch '^\s*VITE_PUSH_WORKER_URL\s*=' -and $_ -notmatch '^\s*VITE_WEB_PUSH_PUBLIC_KEY\s*='
  }
  $envLines = $filtered + $envLines
}
Set-Content -Path $EnvLocal -Value ($envLines -join "`n")
Write-Host "Wrote $EnvLocal"
Write-Host "Next: npm run build; firebase deploy --only firestore:rules,hosting"
