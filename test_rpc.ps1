$url = "https://jtonmfevmcmnkmdjmubn.supabase.co/rest/v1/rpc/get_public_page"
$key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0b25tZmV2bWNtbmttZGptdWJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNTE0MDMsImV4cCI6MjEwNTgyNzQwM30.SLrkoolgzsCVgLW2XJusgh1QCSYMPrq2TzppYK1irgs"
$body = '{"p_slug":"logtraq-boutique"}'
$response = Invoke-RestMethod -Uri $url -Method Post -Headers @{ "apikey" = $key; "Authorization" = "Bearer $key"; "Content-Type" = "application/json" } -Body $body
$response | ConvertTo-Json -Depth 5
