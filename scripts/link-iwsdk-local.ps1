# Sync local @iwsdk/* tgz into OpenNexus3DStudio (Windows-native).
# Usage: .\scripts\link-iwsdk-local.ps1
#        .\scripts\link-iwsdk-local.ps1 -Rebuild

param([switch]$Rebuild)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$IwsdkRoot = if ($env:IWSDK_ROOT) { $env:IWSDK_ROOT } else { Join-Path (Split-Path -Parent $Root) "immersive-web-sdk" }

if (-not (Test-Path (Join-Path $IwsdkRoot "packages\core"))) {
    Write-Host "Cloning immersive-web-sdk..."
    git clone https://github.com/AlfaOmegaGrafx/immersive-web-sdk.git $IwsdkRoot
}

Set-Location $IwsdkRoot
Write-Host "Updating fork from origin/main..."
git fetch origin main
git checkout main
git reset --hard origin/main

$needBuild = $Rebuild.IsPresent
if (-not $needBuild) {
    foreach ($pkg in @('core', 'locomotor', 'xr-input', 'cli', 'vite-plugin-dev', 'reference')) {
        if (-not (Test-Path (Join-Path $IwsdkRoot "packages\$pkg\iwsdk-$pkg.tgz"))) {
            $needBuild = $true
            break
        }
    }
}

if ($needBuild) {
    Write-Host "Building IWSDK tgz packages..."
    if (Get-Command pnpm -ErrorAction SilentlyContinue) {
        pnpm install --ignore-scripts
    } else {
        corepack enable
        corepack prepare pnpm@latest --activate
        pnpm install --ignore-scripts
    }
    $gitBash = 'C:\Program Files\Git\bin\bash.exe'
    if (-not (Test-Path $gitBash)) {
        throw "Git Bash required for build:tgz on Windows: $gitBash"
    }
    $bashRoot = ($IwsdkRoot -replace '\\', '/')
    & $gitBash -lc "cd '$bashRoot' && npm_config_confirmModulesPurge=false bash ./scripts/build-tgz.sh --skip-reference-assets"
}

Set-Location $Root
Write-Host "Installing local @iwsdk/* into OpenNexus3DStudio..."
$core = (Join-Path $IwsdkRoot "packages\core\iwsdk-core.tgz") -replace '\\', '/'
$loco = (Join-Path $IwsdkRoot "packages\locomotor\iwsdk-locomotor.tgz") -replace '\\', '/'
$xr = (Join-Path $IwsdkRoot "packages\xr-input\iwsdk-xr-input.tgz") -replace '\\', '/'
$cli = (Join-Path $IwsdkRoot "packages\cli\iwsdk-cli.tgz") -replace '\\', '/'
$vite = (Join-Path $IwsdkRoot "packages\vite-plugin-dev\iwsdk-vite-plugin-dev.tgz") -replace '\\', '/'
$ref = (Join-Path $IwsdkRoot "packages\reference\iwsdk-reference.tgz") -replace '\\', '/'

npm install --no-save `
  "@iwsdk/core@file:$core" `
  "@iwsdk/locomotor@file:$loco" `
  "@iwsdk/xr-input@file:$xr" `
  "@iwsdk/cli@file:$cli" `
  "@iwsdk/vite-plugin-dev@file:$vite" `
  "@iwsdk/reference@file:$ref"

Write-Host "Done. Verify: npm ls @iwsdk/core @iwsdk/locomotor @iwsdk/xr-input"
