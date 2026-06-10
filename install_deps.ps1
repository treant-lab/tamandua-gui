Set-Location "D:\treant\tamandua\apps\tamandua_gui"
npm install 2>&1 | Out-File -FilePath "npm_install.log" -Encoding utf8
if ($LASTEXITCODE -eq 0) {
    powershell -ExecutionPolicy Bypass -File ".\scripts\check-tauri-prereqs.ps1" -PortableOnly
}
Write-Host "Done. Check npm_install.log for output."
