param(
    [switch]$PortableOnly
)

$ErrorActionPreference = "Stop"

function Write-Status {
    param(
        [string]$Label,
        [string]$Value
    )

    Write-Host ("{0,-28} {1}" -f $Label, $Value)
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$srcTauri = Join-Path $repoRoot "src-tauri"
$nodeModules = Join-Path $repoRoot "node_modules"
$packageJsonPath = Join-Path $repoRoot "package.json"
$tauriConfigPath = Join-Path $srcTauri "tauri.conf.json"
$iconIcnsPath = Join-Path $srcTauri "icons\icon.icns"

$packageJson = Get-Content $packageJsonPath -Raw | ConvertFrom-Json
$tauriCliConstraint = $packageJson.devDependencies."@tauri-apps/cli"

$localTauriInstalled = Test-Path (Join-Path $nodeModules "@tauri-apps\cli")
$cargoTauriVersion = ""
try {
    $cargoTauriVersion = (& cargo tauri -V 2>$null)
} catch {
    $cargoTauriVersion = ""
}

$wixFound = $null -ne (Get-Command candle.exe -ErrorAction SilentlyContinue) -or $null -ne (Get-Command wix.exe -ErrorAction SilentlyContinue)
$nsisFound = $null -ne (Get-Command makensis.exe -ErrorAction SilentlyContinue)
$tauriConfig = Get-Content $tauriConfigPath -Raw | ConvertFrom-Json
$updaterEndpoint = ($tauriConfig.tauri.updater.endpoints | Select-Object -First 1)

$issues = New-Object System.Collections.Generic.List[string]

Write-Host ""
Write-Host "Tamandua GUI packaging preflight"
Write-Host ""
Write-Status "Repo path" $repoRoot
Write-Status "Tauri config format" "v1 (tauri.conf.json has build/package/tauri)"
Write-Status "Expected CLI line" $tauriCliConstraint
Write-Status "Local node_modules" ($(if ($localTauriInstalled) { "present" } else { "missing" }))
Write-Status "Global cargo tauri" ($(if ($cargoTauriVersion) { $cargoTauriVersion } else { "not found" }))
Write-Status "WiX Toolset" ($(if ($wixFound) { "available" } else { "missing" }))
Write-Status "NSIS" ($(if ($nsisFound) { "available" } else { "missing" }))
Write-Status "macOS .icns icon" ($(if (Test-Path $iconIcnsPath) { "present" } else { "missing" }))
Write-Status "GUI updater feed" $updaterEndpoint
Write-Host ""

if (-not $localTauriInstalled) {
    $issues.Add("Local @tauri-apps/cli is not installed. Run 'npm install' in apps/tamandua_gui before bundling.")
}

if ($cargoTauriVersion -match "tauri-cli 2\.") {
    $issues.Add("Global 'cargo tauri' is v2 while this app is configured for Tauri v1. Use 'npm run tauri:build' or 'npx @tauri-apps/cli@1.5 build' instead of 'cargo tauri build'.")
}

if (-not $PortableOnly -and -not $wixFound) {
    $issues.Add("WiX Toolset is missing. Full Windows MSI bundling will not work until candle.exe or wix.exe is installed and in PATH.")
}

if (-not (Test-Path $iconIcnsPath)) {
    $issues.Add("src-tauri/icons/icon.icns is missing. Windows builds can proceed, but macOS app/dmg bundling is not repo-complete.")
}

if ($updaterEndpoint -match "updates\.tamandua\.io" -and $tauriConfig.tauri.updater.pubkey -match "placeholder") {
    $issues.Add("The Tauri GUI updater feed is still pointed at the production URL with a placeholder development public key. GUI self-update is not publish-ready.")
}

if ($issues.Count -eq 0) {
    Write-Host "Preflight status: OK"
    exit 0
}

Write-Host "Preflight status: BLOCKED"
Write-Host ""
for ($i = 0; $i -lt $issues.Count; $i++) {
    Write-Host ("{0}. {1}" -f ($i + 1), $issues[$i])
}

exit 1
