# PowerShell script for starting development server with memory configuration
$env:NODE_ENV = "development"

Write-Host "Starting development server with memory limits:" -ForegroundColor Green
Write-Host "  NODE_ENV: $env:NODE_ENV" -ForegroundColor Cyan
Write-Host "  GC Exposed: Yes" -ForegroundColor Cyan
Write-Host ""

$env:NODE_OPTIONS = "--expose-gc"
npx nest start --watch