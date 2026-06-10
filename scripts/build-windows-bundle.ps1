param(
    [switch]$PortableOnly
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$workspaceRoot = Split-Path -Parent (Split-Path -Parent $repoRoot)
$srcTauri = Join-Path $repoRoot "src-tauri"
$bundleRoot = Join-Path $repoRoot "target\bundle"
$releaseExe = Join-Path $srcTauri "target\release\tamandua-gui.exe"
$agentRoot = Join-Path $workspaceRoot "apps\tamandua_agent"
$agentReleaseExe = Join-Path $agentRoot "target\release\tamandua-agent.exe"
$portableZip = Join-Path $bundleRoot "tamandua-gui-0.1.0-win64.zip"

Push-Location $repoRoot
try {
    if (-not (Test-Path (Join-Path $repoRoot "node_modules\@tauri-apps\cli"))) {
        throw "Local @tauri-apps/cli is missing. Run 'npm install' in apps/tamandua_gui first."
    }

    Write-Host "Running packaging preflight..."
    & powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "check-tauri-prereqs.ps1") @(
        if ($PortableOnly) { "-PortableOnly" }
    )
    if ($LASTEXITCODE -ne 0 -and -not $PortableOnly) {
        throw "Packaging preflight failed. See messages above."
    }

    Write-Host "Building frontend..."
    & npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "Frontend build failed."
    }

    if (-not $PortableOnly) {
        $wixFound = $null -ne (Get-Command candle.exe -ErrorAction SilentlyContinue) -or $null -ne (Get-Command wix.exe -ErrorAction SilentlyContinue)
        if ($wixFound) {
            Write-Host "Building full Tauri bundle with local v1 CLI..."
            & npm run tauri:build:windows
            if ($LASTEXITCODE -ne 0) {
                throw "Tauri bundle build failed."
            }

            Write-Host "Full bundle completed."
            exit 0
        }

        Write-Warning "WiX Toolset was not found. Falling back to portable bundle."
    }

    Write-Host "Building portable executable..."
    & cargo build --manifest-path (Join-Path $srcTauri "Cargo.toml") --release
    if ($LASTEXITCODE -ne 0) {
        throw "Rust release build failed."
    }

    Write-Host "Building bundled agent executable..."
    & cargo build --manifest-path (Join-Path $agentRoot "Cargo.toml") --bin tamandua-agent --release
    if ($LASTEXITCODE -ne 0) {
        throw "Agent release build failed."
    }

    if (-not (Test-Path $releaseExe)) {
        throw "Release executable was not generated at $releaseExe"
    }

    if (-not (Test-Path $agentReleaseExe)) {
        throw "Agent executable was not generated at $agentReleaseExe"
    }

    New-Item -ItemType Directory -Force -Path $bundleRoot | Out-Null
    Copy-Item $releaseExe (Join-Path $bundleRoot "tamandua-gui.exe") -Force
    Copy-Item $agentReleaseExe (Join-Path $bundleRoot "tamandua-agent.exe") -Force

    if (Test-Path $portableZip) {
        Remove-Item $portableZip -Force
    }

    Compress-Archive -Path @(
        (Join-Path $bundleRoot "tamandua-gui.exe"),
        (Join-Path $bundleRoot "tamandua-agent.exe")
    ) -DestinationPath $portableZip
    Write-Host "Portable bundle created at $portableZip"
}
finally {
    Pop-Location
}
