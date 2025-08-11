# PowerShell script for starting debug server with memory configuration
$env:NODE_ENV = "development"

Write-Host "Starting debug server with memory limits:" -ForegroundColor Green
Write-Host "  NODE_ENV: $env:NODE_ENV" -ForegroundColor Cyan
Write-Host "  GC Exposed: Yes" -ForegroundColor Cyan
Write-Host "  Debug Mode: Enabled" -ForegroundColor Yellow
Write-Host ""

$env:NODE_OPTIONS = "--expose-gc --inspect"
npx nest start --debug --watch