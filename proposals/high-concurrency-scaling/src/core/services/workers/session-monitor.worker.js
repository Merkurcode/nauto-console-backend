const { parentPort, workerData } = require('worker_threads');
const Redis = require('ioredis');

/**
 * Session Monitor Worker Thread
 * 
 * Handles session monitoring tasks in a separate thread:
 * - Session cleanup and garbage collection
 * - Session metrics calculation
 * - Memory usage monitoring
 * - Non-blocking operations to prevent API slowdown
 */
class SessionMonitorWorker {
  constructor(config) {
    this.config = config;
    this.redis = null;
    this.isRunning = false;
    this.cleanupInterval = null;
    this.metricsInterval = null;
    this.healthInterval = null;
    
    this.metrics = {
      totalSessions: 0,
      activeSessions: 0,
      expiredSessions: 0,
      invalidSessions: 0,
      averageSessionDuration: 0,
      peakConcurrentSessions: 0,
      memoryUsage: 0,
      lastCleanup: Date.now(),
    };
    
    this.initialize();
  }

  async initialize() {
    try {
      // Connect to Redis
      this.redis = new Redis(this.config.redisUrl, {
        retryDelayOnFailover: 1000,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });

      await this.redis.connect();
      
      this.isRunning = true;
      
      // Start periodic tasks
      this.startCleanupTask();
      this.startMetricsTask();
      this.startHealthReporting();
      
      // Notify main thread that worker is ready
      this.sendMessage('health', { ready: true });
      
      console.log('Session monitor worker initialized successfully');
    } catch (error) {
      this.sendMessage('error', {
        error: error.message,
        context: 'initialization',
      });
    }
  }

  /**
   * Start periodic session cleanup task
   */
  startCleanupTask() {
    this.cleanupInterval = setInterval(async () => {
      await this.performSessionCleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Start periodic metrics calculation
   */
  startMetricsTask() {
    this.metricsInterval = setInterval(async () => {
      await this.calculateMetrics();
    }, this.config.metricsInterval);
  }

  /**
   * Start health reporting
   */
  startHealthReporting() {
    this.healthInterval = setInterval(() => {
      this.sendMessage('health', {
        ready: this.isRunning,
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime(),
      });
    }, 30000); // Every 30 seconds
  }

  /**
   * Perform session cleanup
   */
  async performSessionCleanup() {
    const startTime = Date.now();
    let cleanedCount = 0;

    try {
      // Get all session keys
      const sessionKeys = await this.redis.keys('session:*');
      
      if (sessionKeys.length === 0) {
        this.sendMessage('cleanup', {
          cleaned: 0,
          duration: Date.now() - startTime,
        });
        return;
      }

      // Process sessions in batches to prevent memory issues
      const batchSize = this.config.batchSize;
      const batches = [];
      
      for (let i = 0; i < sessionKeys.length; i += batchSize) {
        batches.push(sessionKeys.slice(i, i + batchSize));
      }

      for (const batch of batches) {
        const pipeline = this.redis.pipeline();
        const expiredKeys = [];

        // Check TTL for each session in the batch
        for (const key of batch) {
          pipeline.ttl(key);
        }

        const ttlResults = await pipeline.exec();
        
        // Identify expired sessions
        for (let i = 0; i < batch.length; i++) {
          const ttl = ttlResults[i][1];
          
          // TTL -2 means key doesn't exist, -1 means no expiry set
          if (ttl === -2 || ttl === -1) {
            expiredKeys.push(batch[i]);
          }
        }

        // Remove expired sessions
        if (expiredKeys.length > 0) {
          await this.redis.del(...expiredKeys);
          cleanedCount += expiredKeys.length;
          this.metrics.expiredSessions += expiredKeys.length;
        }
      }

      this.metrics.lastCleanup = Date.now();
      
      this.sendMessage('cleanup', {
        cleaned: cleanedCount,
        duration: Date.now() - startTime,
        totalSessions: sessionKeys.length,
      });
      
    } catch (error) {
      this.sendMessage('error', {
        error: error.message,
        context: 'session_cleanup',
      });
    }
  }

  /**
   * Calculate session metrics
   */
  async calculateMetrics() {
    try {
      const startTime = Date.now();
      
      // Get session statistics
      const sessionKeys = await this.redis.keys('session:*');
      const activeSessionCount = sessionKeys.length;
      
      // Calculate session durations for active sessions (sample)
      const sampleSize = Math.min(100, sessionKeys.length);
      const sampleKeys = sessionKeys.slice(0, sampleSize);
      
      let totalDuration = 0;
      let validSessions = 0;
      
      if (sampleKeys.length > 0) {
        const pipeline = this.redis.pipeline();
        
        for (const key of sampleKeys) {
          pipeline.hget(key, 'createdAt');
        }
        
        const results = await pipeline.exec();
        const now = Date.now();
        
        for (const result of results) {
          if (result[1]) {
            const createdAt = parseInt(result[1]);
            if (!isNaN(createdAt)) {
              totalDuration += now - createdAt;
              validSessions++;
            }
          }
        }
      }
      
      // Update metrics
      this.metrics.activeSessions = activeSessionCount;
      this.metrics.totalSessions += activeSessionCount; // Cumulative
      
      if (validSessions > 0) {
        this.metrics.averageSessionDuration = totalDuration / validSessions;
      }
      
      // Track peak concurrent sessions
      if (activeSessionCount > this.metrics.peakConcurrentSessions) {
        this.metrics.peakConcurrentSessions = activeSessionCount;
      }
      
      // Memory usage
      const memUsage = process.memoryUsage();
      this.metrics.memoryUsage = memUsage.heapUsed;
      
      // Send metrics to main thread
      this.sendMessage('metrics', {
        ...this.metrics,
        calculationDuration: Date.now() - startTime,
      });
      
    } catch (error) {
      this.sendMessage('error', {
        error: error.message,
        context: 'metrics_calculation',
      });
    }
  }

  /**
   * Handle messages from main thread
   */
  handleMessage(message) {
    switch (message.type) {
      case 'cleanup':
        this.performSessionCleanup();
        break;
        
      case 'health_check':
        this.sendMessage('health', {
          ready: this.isRunning,
          metrics: this.metrics,
          memoryUsage: process.memoryUsage(),
        });
        break;
        
      case 'shutdown':
        this.shutdown();
        break;
        
      default:
        console.log('Unknown message type:', message.type);
    }
  }

  /**
   * Send message to main thread
   */
  sendMessage(type, data) {
    if (parentPort) {
      parentPort.postMessage({
        type,
        data,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    try {
      this.isRunning = false;
      
      // Clear intervals
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = null;
      }
      
      if (this.metricsInterval) {
        clearInterval(this.metricsInterval);
        this.metricsInterval = null;
      }
      
      if (this.healthInterval) {
        clearInterval(this.healthInterval);
        this.healthInterval = null;
      }
      
      // Close Redis connection
      if (this.redis) {
        await this.redis.quit();
        this.redis = null;
      }
      
      console.log('Session monitor worker shut down gracefully');
      process.exit(0);
    } catch (error) {
      console.error('Error during worker shutdown:', error.message);
      process.exit(1);
    }
  }
}

// Initialize worker
const worker = new SessionMonitorWorker(workerData.config);

// Handle messages from main thread
if (parentPort) {
  parentPort.on('message', (message) => {
    worker.handleMessage(message);
  });
}

// Handle process termination
process.on('SIGINT', () => worker.shutdown());
process.on('SIGTERM', () => worker.shutdown());

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception in worker:', error);
  worker.sendMessage('error', {
    error: error.message,
    context: 'uncaught_exception',
  });
  worker.shutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection in worker:', reason);
  worker.sendMessage('error', {
    error: String(reason),
    context: 'unhandled_rejection',
  });
});