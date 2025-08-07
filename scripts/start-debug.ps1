# PowerShell script for starting debug server with memory configuration
$env:NODE_ENV = "development"
$env:NODE_MAX_OLD_SPACE_SIZE = "2048"
$env:NODE_MAX_SEMI_SPACE_SIZE = "64"

Write-Host "Starting debug server with memory limits:" -ForegroundColor Green
Write-Host "  NODE_ENV: $env:NODE_ENV" -ForegroundColor Cyan
Write-Host "  Max Old Space: $($env:NODE_MAX_OLD_SPACE_SIZE)MB" -ForegroundColor Cyan
Write-Host "  Max Semi Space: $($env:NODE_MAX_SEMI_SPACE_SIZE)MB" -ForegroundColor Cyan
Write-Host "  GC Exposed: Yes" -ForegroundColor Cyan
Write-Host "  Debug Mode: Enabled" -ForegroundColor Yellow
Write-Host ""

$env:NODE_OPTIONS = "--max-old-space-size=$($env:NODE_MAX_OLD_SPACE_SIZE) --max-semi-space-size=$($env:NODE_MAX_SEMI_SPACE_SIZE) --expose-gc --inspect"
npx nest start --debug --watch