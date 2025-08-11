# Simple PowerShell script for starting development server
$env:NODE_ENV = "development"

Write-Host "Starting development server with memory limits:" -ForegroundColor Green
Write-Host "  NODE_ENV: $env:NODE_ENV" -ForegroundColor Cyan
Write-Host ""

# Start with minimal node options
# $env:NODE_OPTIONS = ""  # No specific node options needed
npx nest start --watch