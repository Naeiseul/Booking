$headers = @{
    'apikey' = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0b25tZmV2bWNtbmttZGptdWJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNTE0MDMsImV4cCI6MjEwNTgyNzQwM30.SLrkoolgzsCVgLW2XJusgh1QCSYMPrq2TzppYK1irgs'
}
$tables = @('availability', 'time_slots', 'business_slots', 'schedule', 'schedules', 'appointments', 'bookings', 'slot', 'business_availability', 'slots')
foreach ($table in $tables) {
    try {
        Invoke-RestMethod -Uri "https://jtonmfevmcmnkmdjmubn.supabase.co/rest/v1/${table}?select=id" -Method Get -Headers $headers
    } catch {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $body = $reader.ReadToEnd()
        Write-Host "$table : $($_.Exception.Response.StatusCode.value__) : $body"
    }
}
