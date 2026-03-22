$ErrorActionPreference = "Stop"

$baseUrl = if ($env:BASE_URL) { $env:BASE_URL.TrimEnd('/') } else { "http://127.0.0.1:8000" }
Write-Output "Using BASE_URL=$baseUrl"

Write-Output "1) Health"
$health = Invoke-RestMethod "$baseUrl/api/health" -Method Get
$health | ConvertTo-Json -Compress | Write-Output

Write-Output "2) Suggest"
$suggest = Invoke-RestMethod "$baseUrl/api/search/suggest?query=surat&limit=5" -Method Get
$suggest | ConvertTo-Json -Compress | Write-Output

Write-Output "3) Smart search"
$smart = Invoke-RestMethod "$baseUrl/api/search/smart?query=house%20surat&limit=3" -Method Get
$smart | ConvertTo-Json -Compress | Write-Output

Write-Output "4) Register temp user + authenticated voice"
$u = [guid]::NewGuid().ToString().Substring(0, 8)
$body = @{
  name = "Smoke User $u"
  email = "smoke_$u@test.com"
  phone = "9876543210"
  password = "SmokePass123"
  gender = "male"
  address = "Smoke Address"
  city = "Surat"
  state = "Gujarat"
} | ConvertTo-Json

$reg = Invoke-RestMethod "$baseUrl/api/auth/register" -Method Post -ContentType "application/json" -Body $body
$token = $reg.token
if (-not $token) { throw "Register did not return token" }

$voice = Invoke-RestMethod "$baseUrl/api/chat/voice?query=ghar%20surat" -Method Post -Headers @{ Authorization = "Bearer $token" }
$voice | ConvertTo-Json -Compress | Write-Output

Write-Output "Smoke check passed."
