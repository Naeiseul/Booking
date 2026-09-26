$url = "https://jtonmfevmcmnkmdjmubn.supabase.co/rest/v1/rpc/get_public_page"
$key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0b25tZmV2bWNtbmttZGptdWJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNTE0MDMsImV4cCI6MjEwNTgyNzQwM30.SLrkoolgzsCVgLW2XJusgh1QCSYMPrq2TzppYK1irgs"
$headers = @{ "apikey" = $key; "Authorization" = "Bearer $key"; "Content-Type" = "application/json" }
$body = @{ p_slug = "logtraq-boutique" } | ConvertTo-Json
$response = Invoke-RestMethod -Uri $url -Method Post -Body $body -Headers $headers
$response | ConvertTo-Json
