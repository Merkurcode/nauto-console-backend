const http = require('http');
const { execSync } = require('child_process');

/**
 * Standalone health check script for Docker containers
 * 
 * This script is used by Docker health checks to verify
 * the application is running correctly.
 */

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';
const TIMEOUT = 5000; // 5 seconds timeout

function performHealthCheck() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: HOST,
      port: PORT,
      path: '/health',
      method: 'GET',
      timeout: TIMEOUT,
      headers: {
        'User-Agent': 'docker-health-check'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('Health check PASSED');
          resolve({
            status: 'healthy',
            statusCode: res.statusCode,
            response: data.substring(0, 100) // Limit response length
          });
        } else {
          console.error(`Health check FAILED - Status: ${res.statusCode}`);
          reject(new Error(`Health check failed with status ${res.statusCode}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error('Health check ERROR:', error.message);
      reject(error);
    });

    req.on('timeout', () => {
      console.error('Health check TIMEOUT');
      req.destroy();
      reject(new Error('Health check timeout'));
    });

    req.end();
  });
}

// Additional checks
function checkMemoryUsage() {
  const memUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
  const heapUtilization = Math.round((heapUsedMB / heapTotalMB) * 100);
  
  console.log(`Memory: ${heapUsedMB}MB/${heapTotalMB}MB (${heapUtilization}%)`);
  
  // Fail if memory usage is too high
  if (heapUtilization > 95) {
    throw new Error(`Critical memory usage: ${heapUtilization}%`);
  }
}

function checkUptime() {
  const uptimeSeconds = Math.round(process.uptime());
  console.log(`Uptime: ${uptimeSeconds}s`);
  
  // Fail if process just started (might still be initializing)
  if (uptimeSeconds < 10) {
    throw new Error('Process still initializing');
  }
}

async function main() {
  try {
    console.log('Starting Docker health check...');
    console.log(`Target: http://${HOST}:${PORT}/health`);
    
    // Check basic process health
    checkMemoryUsage();
    checkUptime();
    
    // Perform HTTP health check
    await performHealthCheck();
    
    console.log('All health checks PASSED');
    process.exit(0);
  } catch (error) {
    console.error('Health check FAILED:', error.message);
    process.exit(1);
  }
}

// Handle unhandled errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception during health check:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection during health check:', reason);
  process.exit(1);
});

// Run health check
main();