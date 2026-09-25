$headers = @{
    'apikey' = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0b25tZmV2bWNtbmttZGptdWJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNTE0MDMsImV4cCI6MjEwNTgyNzQwM30.SLrkoolgzsCVgLW2XJusgh1QCSYMPrq2TzppYK1irgs'
    'Content-Type' = 'application/json'
}
$body = @{ p_slug = 'balon-salon' } | ConvertTo-Json
try {
    Invoke-RestMethod -Uri 'https://jtonmfevmcmnkmdjmubn.supabase.co/rest/v1/rpc/get_public_page' -Method Post -Headers $headers -Body $body | ConvertTo-Json
} catch {
    Write-Host "$($_.Exception.Response.StatusCode.value__) : $($reader.ReadToEnd())"
}
