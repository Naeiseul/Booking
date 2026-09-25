$headers = @{
    'apikey' = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0b25tZmV2bWNtbmttZGptdWJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNTE0MDMsImV4cCI6MjEwNTgyNzQwM30.SLrkoolgzsCVgLW2XJusgh1QCSYMPrq2TzppYK1irgs'
}
$columns = @('status', 'client_name', 'slot_date', 'slot_time', 'booking_date', 'booking_time', 'day', 'hour', 'date', 'time')
foreach ($col in $columns) {
    try {
        Invoke-RestMethod -Uri "https://jtonmfevmcmnkmdjmubn.supabase.co/rest/v1/availability?select=$col" -Method Get -Headers $headers
    } catch {
        Write-Host "$col : $($_.Exception.Response.StatusCode.value__)"
    }
}
