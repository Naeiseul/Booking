$gitPath = (Get-ChildItem -Path "$env:LOCALAPPDATA\GitHubDesktop\app-*\resources\app\git\cmd\git.exe" -ErrorAction SilentlyContinue | Select-Object -First 1).FullName
if (-not $gitPath) { $gitPath = "C:\Program Files\Git\cmd\git.exe" }
if (Test-Path $gitPath) {
    & $gitPath add .
    & $gitPath commit -m "Refactor: Swapped dynamic URL hours for a static 7AM-8PM grid for ultimate owner freedom"
    Write-Host "Success"
} else {
    Write-Host "Could not find git"
}
