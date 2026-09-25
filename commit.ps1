$gitPath = (Get-ChildItem -Path "$env:LOCALAPPDATA\GitHubDesktop\app-*\resources\app\git\cmd\git.exe" -ErrorAction SilentlyContinue | Select-Object -First 1).FullName
if (-not $gitPath) { $gitPath = "C:\Program Files\Git\cmd\git.exe" }
if (Test-Path $gitPath) {
    & $gitPath add .
    & $gitPath commit -m "Fix: Updated local memory when clicking slots so switching tabs doesn't revert UI"
    Write-Host "Success"
} else {
    Write-Host "Could not find git"
}
