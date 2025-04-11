import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import os from 'os';
import fetch from 'node-fetch';
import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';
import { parse as parseUrl } from 'url';
import { program } from 'commander';

// Default configuration
const defaultConfig = {
  url: 'http://127.0.0.1:5500/',
  totalRequests: 5000,
  concurrency: os.cpus().length,
  batchSize: 50,
  timeout: 30000,
  headers: {},
  method: 'GET',
  body: null,
  reportInterval: 500,
  followRedirects: true,
  maxRedirects: 5,
  keepAlive: true,
  maxSockets: 100,
  rejectUnauthorized: true // Set to false to ignore SSL certificate errors (not recommended for production)
};

// Parse command line arguments if in main thread
if (isMainThread) {
  program
    .option('-u, --url <url>', 'Target URL', defaultConfig.url)
    .option('-n, --requests <number>', 'Total number of requests', String(defaultConfig.totalRequests))
    .option('-c, --concurrency <number>', 'Number of concurrent workers', String(defaultConfig.concurrency))
    .option('-b, --batch-size <number>', 'Requests per batch', String(defaultConfig.batchSize))
    .option('-t, --timeout <number>', 'Request timeout in ms', String(defaultConfig.timeout))
    .option('-m, --method <method>', 'HTTP method', defaultConfig.method)
    .option('-H, --header <header>', 'Request headers (can be used multiple times)', collectHeaders, {})
    .option('-d, --data <data>', 'Request body data')
    .option('-k, --insecure', 'Allow insecure TLS connections', false)
    .option('-f, --follow-redirects', 'Follow HTTP redirects', defaultConfig.followRedirects)
    .option('-r, --max-redirects <number>', 'Maximum number of redirects', String(defaultConfig.maxRedirects))
    .parse(process.argv);

  const options = program.opts();
  
  // Merge command line options with defaults
  const config = {
    ...defaultConfig,
    url: options.url,
    totalRequests: parseInt(options.requests, 10),
    concurrency: parseInt(options.concurrency, 10),
    batchSize: parseInt(options.batchSize, 10),
    timeout: parseInt(options.timeout, 10),
    method: options.method,
    headers: options.header,
    body: options.data,
    rejectUnauthorized: !options.insecure,
    followRedirects: options.followRedirects,
    maxRedirects: parseInt(options.maxRedirects, 10)
  };

  // Start the load test
  runLoadTest(config);
}

// Helper function to collect multiple headers
function collectHeaders(value, previous) {
  if (value.includes(':')) {
    const [name, val] = value.split(':', 2);
    previous[name.trim()] = val.trim();
  }
  return previous;
}

// Main function to run the load test
function runLoadTest(config) {
  console.log(`Starting load test with the following configuration:`);
  console.log(`URL: ${config.url}`);
  console.log(`Total Requests: ${config.totalRequests}`);
  console.log(`Concurrency: ${config.concurrency} workers`);
  console.log(`Method: ${config.method}`);
  
  const startTime = Date.now();
  let completedWorkers = 0;
  let totalSuccess = 0;
  let totalFailure = 0;
  let statusCodes = {};
  
  // Calculate requests per worker
  const requestsPerWorker = Math.floor(config.totalRequests / config.concurrency);
  const remainder = config.totalRequests % config.concurrency;
  
  // Create workers
  for (let i = 0; i < config.concurrency; i++) {
    // Distribute remainder requests among first few workers
    const workerRequests = i < remainder ? requestsPerWorker + 1 : requestsPerWorker;
    
    const worker = new Worker(new URL(import.meta.url), { 
      workerData: {
        config,
        requestsPerWorker: workerRequests
      }
    });
    
    worker.on('message', (message) => {
      if (message.type === 'progress') {
        // Progress updates
        process.stdout.write(`\rProgress: ${Math.round(message.percentage)}% | Success: ${totalSuccess} | Failed: ${totalFailure}`);
      } else if (message.type === 'complete') {
        completedWorkers++;
        totalSuccess += message.results.success;
        totalFailure += message.results.failure;
        
        // Aggregate status codes
        Object.entries(message.results.statusCodes).forEach(([code, count]) => {
          statusCodes[code] = (statusCodes[code] || 0) + count;
        });
        
        if (completedWorkers === config.concurrency) {
          const duration = (Date.now() - startTime) / 1000;
          const requestsPerSecond = Math.round((totalSuccess + totalFailure) / duration);
          
          console.log('\n\nLoad test completed:');
          console.log(`Duration: ${duration.toFixed(2)} seconds`);
          console.log(`Requests per second: ${requestsPerSecond}`);
          console.log(`Successful requests: ${totalSuccess}`);
          console.log(`Failed requests: ${totalFailure}`);
          console.log('\nStatus code distribution:');
          Object.entries(statusCodes)
            .sort(([a], [b]) => parseInt(a) - parseInt(b))
            .forEach(([code, count]) => {
              console.log(`  ${code}: ${count}`);
            });
        }
      }
    });
    
    worker.on('error', (error) => {
      console.error(`Worker error: ${error}`);
      completedWorkers++;
    });
  }
}

// Worker thread function
async function workerFunction({ config, requestsPerWorker }) {
  // Parse URL to determine if HTTP or HTTPS
  const parsedUrl = parseUrl(config.url);
  const isHttps = parsedUrl.protocol === 'https:';
  
  // Create appropriate agent based on protocol
  const agent = isHttps 
    ? new HttpsAgent({
        keepAlive: config.keepAlive,
        maxSockets: config.maxSockets,
        timeout: config.timeout,
        rejectUnauthorized: config.rejectUnauthorized
      })
    : new HttpAgent({
        keepAlive: config.keepAlive,
        maxSockets: config.maxSockets,
        timeout: config.timeout
      });
  
  const results = { 
    success: 0, 
    failure: 0,
    statusCodes: {}
  };
  
  // Process in batches for better performance
  for (let i = 0; i < requestsPerWorker; i += config.batchSize) {
    const currentBatchSize = Math.min(config.batchSize, requestsPerWorker - i);
    const promises = [];
    
    // Create a batch of promises
    for (let j = 0; j < currentBatchSize; j++) {
      promises.push(
        fetch(config.url, { 
          method: config.method,
          headers: config.headers,
          body: config.body,
          agent,
          redirect: config.followRedirects ? 'follow' : 'manual',
          follow: config.maxRedirects,
          timeout: config.timeout
        })
        .then(response => {
          // Track status codes
          const statusCode = response.status;
          results.statusCodes[statusCode] = (results.statusCodes[statusCode] || 0) + 1;
          
          if (response.ok) {
            results.success++;
          } else {
            results.failure++;
          }
        })
        .catch(() => {
          results.failure++;
        })
      );
    }
    
    // Wait for all promises in the batch to resolve
    await Promise.all(promises);
    
    // Report progress
    if (i % config.reportInterval === 0 || i + currentBatchSize >= requestsPerWorker) {
      const percentage = ((i + currentBatchSize) / requestsPerWorker) * 100;
      parentPort.postMessage({ 
        type: 'progress', 
        completed: i + currentBatchSize,
        total: requestsPerWorker,
        percentage
      });
    }
  }
  
  // Send final results
  parentPort.postMessage({ type: 'complete', results });
}

// Execute worker function if in worker thread
if (!isMainThread) {
  workerFunction(workerData);
}

// Export as a module for reuse
export default runLoadTest;