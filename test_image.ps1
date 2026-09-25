try {
    $response = Invoke-WebRequest -Uri "https://jtonmfevmcmnkmdjmubn.supabase.co/storage/v1/object/public/logos/images%20(2).jpg" -Method Head
    Write-Host "Status: $($response.StatusCode)"
} catch {
    Write-Host "Error: $($_.Exception.Response.StatusCode.value__)"
}
