$body = @{ p_slug = 'balon-salon'; p_key = 'secret123'; p_date = '2026-09-25'; p_time = '08:00'; p_status = 'open' } | ConvertTo-Json
$headers = @{
    'apikey' = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0b25tZmV2bWNtbmttZGptdWJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNTE0MDMsImV4cCI6MjEwNTgyNzQwM30.SLrkoolgzsCVgLW2XJusgh1QCSYMPrq2TzppYK1irgs'
    'Authorization' = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0b25tZmV2bWNtbmttZGptdWJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNTE0MDMsImV4cCI6MjEwNTgyNzQwM30.SLrkoolgzsCVgLW2XJusgh1QCSYMPrq2TzppYK1irgs'
    'Content-Type' = 'application/json'
}
try {
    Invoke-RestMethod -Uri 'https://jtonmfevmcmnkmdjmubn.supabase.co/rest/v1/rpc/set_slot' -Method Post -Headers $headers -Body $body
    Write-Host "Success"
} catch {
    Write-Host $_.Exception.Response.StatusCode.value__
    Write-Host $_.ErrorDetails.Message
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    Write-Host $reader.ReadToEnd()
}
