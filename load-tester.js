import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import os from 'os';
import fetch from 'node-fetch';
import { Agent } from 'http';

// Target URL
const url = "http://127.0.0.1:5500/";

// Create a connection pool with keep-alive
const httpAgent = new Agent({
  keepAlive: true,
  maxSockets: 100, // Increase concurrent connections
  timeout: 60000
});

// Worker thread function - optimized for speed
async function workerFunction(requestsPerWorker) {
  const batchSize = 50; // Process requests in batches
  const results = { success: 0, failure: 0 };
  
  // Process in batches for better performance
  for (let i = 0; i < requestsPerWorker; i += batchSize) {
    const currentBatchSize = Math.min(batchSize, requestsPerWorker - i);
    const promises = [];
    
    // Create a batch of promises
    for (let j = 0; j < currentBatchSize; j++) {
      promises.push(
        fetch(url, { 
          agent: httpAgent,
          headers: { 'Connection': 'keep-alive' }
        })
        .then(response => {
          if (response.status === 200) {
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
    
    // Minimal logging to avoid overhead
    if (i % 500 === 0) {
      parentPort.postMessage({ type: 'progress', completed: i, total: requestsPerWorker });
    }
  }
  
  // Send final results
  parentPort.postMessage({ type: 'complete', results });
}

// Main thread
if (isMainThread) {
  const totalRequests = 5000;
  const numWorkers = os.cpus().length;
  const requestsPerWorker = Math.floor(totalRequests / numWorkers);
  
  console.log(`Starting optimized load test with ${totalRequests} requests across ${numWorkers} workers`);
  
  const startTime = Date.now();
  let completedWorkers = 0;
  let totalSuccess = 0;
  let totalFailure = 0;
  
  // Create workers
  for (let i = 0; i < numWorkers; i++) {
    const worker = new Worker(new URL(import.meta.url), { 
      workerData: requestsPerWorker 
    });
    
    worker.on('message', (message) => {
      if (message.type === 'progress') {
        // Minimal progress updates
        process.stdout.write(`\rProgress: ${Math.round((message.completed / message.total) * 100)}%`);
      } else if (message.type === 'complete') {
        completedWorkers++;
        totalSuccess += message.results.success;
        totalFailure += message.results.failure;
        
        if (completedWorkers === numWorkers) {
          const duration = (Date.now() - startTime) / 1000;
          const requestsPerSecond = Math.round(totalRequests / duration);
          
          console.log('\n\nLoad test completed:');
          console.log(`Duration: ${duration.toFixed(2)} seconds`);
          console.log(`Requests per second: ${requestsPerSecond}`);
          console.log(`Successful requests: ${totalSuccess}`);
          console.log(`Failed requests: ${totalFailure}`);
        }
      }
    });
    
    worker.on('error', (error) => {
      console.error(`Worker error: ${error}`);
      completedWorkers++;
    });
  }
} else {
  // This code runs in worker threads
  workerFunction(workerData);
}