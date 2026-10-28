# AarHen-AI local smoke test (PowerShell)
# Run against a disposable local/staging instance only.
# This script never prints API keys and never sends customer data or external side-effect actions.

$ErrorActionPreference = "Stop"
$baseUrl = if ($env:AARHEN_BASE_URL) { $env:AARHEN_BASE_URL.TrimEnd("/") } else { "http://localhost:3000" }
$apiKey = $env:AARHEN_API_KEY
$ownerKey = $env:AARHEN_OWNER_API_KEY

function Assert-Status {
    param([string]$Name, [int]$Actual, [int]$Expected)
    if ($Actual -ne $Expected) {
        Write-Host "[FAIL] $Name — expected HTTP $Expected, got HTTP $Actual" -ForegroundColor Red
        $script:failed = $true
    } else {
        Write-Host "[PASS] $Name — HTTP $Actual" -ForegroundColor Green
    }
}

function Get-HttpStatus {
    param([scriptblock]$Request)
    try {
        $response = & $Request
        if ($response -and $response.StatusCode) { return [int]$response.StatusCode }
        return 200
    } catch {
        if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
            return [int]$_.Exception.Response.StatusCode.value__
        }
        throw
    }
}

$script:failed = $false
Write-Host "AarHen-AI smoke test target: $baseUrl"
Write-Host "Use only a local or staging instance. Keys are not displayed."

try {
    $healthStatus = Get-HttpStatus {
        Invoke-WebRequest -Uri "$baseUrl/health" -Method Get -UseBasicParsing
    }
    Assert-Status "Public health endpoint" $healthStatus 200
} catch {
    Write-Host "[FAIL] Health endpoint unavailable: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Start the server first, then rerun this script."
    exit 2
}

$unauthStatus = Get-HttpStatus {
    Invoke-WebRequest -Uri "$baseUrl/ask" -Method Post -ContentType "application/json" -Body '{"input":"AarHen smoke test","context":{"autonomous":false}}' -UseBasicParsing
}
$expectedUnauth = if ($env:NODE_ENV -eq "production" -and -not $apiKey) { 503 } else { 401 }
Assert-Status "Protected /ask rejects missing API key" $unauthStatus $expectedUnauth

if (-not $apiKey) {
    Write-Host "[SKIP] Authenticated request — set AARHEN_API_KEY in this PowerShell session to test it."
} else {
    $headers = @{ Authorization = "Bearer $apiKey" }
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/ask" -Method Post -Headers $headers -ContentType "application/json" -Body '{"input":"Reply with exactly: AarHen smoke test","context":{"autonomous":false}}'
        if ($response.success -eq $true) {
            Write-Host "[PASS] Authenticated harmless /ask request returned success=true" -ForegroundColor Green
        } else {
            Write-Host "[FAIL] Authenticated /ask returned a non-success response. Check provider/configuration errors without sharing secrets." -ForegroundColor Red
            $script:failed = $true
        }
    } catch {
        Write-Host "[FAIL] Authenticated /ask request failed: $($_.Exception.Message)" -ForegroundColor Red
        $script:failed = $true
    }
}

if ($apiKey -and $ownerKey) {
    $wrongOwnerHeaders = @{
        Authorization = "Bearer $apiKey"
        "X-Aarhen-Owner-Key" = "intentionally-invalid-owner-key"
    }
    $ownerStatus = Get-HttpStatus {
        Invoke-WebRequest -Uri "$baseUrl/checkpoint/provider-failure/resolve" -Method Post -Headers $wrongOwnerHeaders -ContentType "application/json" -Body '{}' -UseBasicParsing
    }
    Assert-Status "Owner endpoint rejects invalid owner key" $ownerStatus 401
} else {
    Write-Host "[SKIP] Owner-key negative test — set both AARHEN_API_KEY and AARHEN_OWNER_API_KEY in this session."
}

if ($script:failed) {
    Write-Host "Smoke test result: FAIL. Fix the failed check(s) before proceeding." -ForegroundColor Red
    exit 1
}

Write-Host "Smoke test result: PASS for all checks that ran. Skipped checks are not considered verified." -ForegroundColor Green
