$gitPath = (Get-ChildItem -Path "$env:LOCALAPPDATA\GitHubDesktop\app-*\resources\app\git\cmd\git.exe" -ErrorAction SilentlyContinue | Select-Object -First 1).FullName
if (-not $gitPath) { $gitPath = "C:\Program Files\Git\cmd\git.exe" }
if (Test-Path $gitPath) {
    & $gitPath add .
    & $gitPath commit -m "Fix: Condensed admin grid to fit 14 slots without scrolling, left client side untouched"
    Write-Host "Success"
} else {
    Write-Host "Could not find git"
}
