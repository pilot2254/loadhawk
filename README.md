# LoadHawk

A high-performance HTTP/HTTPS load testing tool built with Node.js, designed for developers and QA engineers who need to evaluate web application performance under various load conditions.

## Features

- **Multi-core Utilization**: Leverages all available CPU cores for maximum performance
- **Protocol Support**: Works with both HTTP and HTTPS endpoints
- **Detailed Metrics**: Provides comprehensive performance statistics and status code distribution
- **Highly Configurable**: Customize concurrency, request patterns, headers, and more
- **Batch Processing**: Efficient request batching for optimal throughput
- **Connection Pooling**: Uses keep-alive connections to reduce overhead
- **Flexible Options**: Support for different HTTP methods, custom headers, and request bodies

## Installation

# Clone the repository
```bash
git clone https://github.com/pilot2254/loadhawk.git
```

# Navigate to the project directory
```bash
cd loadhawk
```

# Install dependencies
```bash
npm install
```

## Usage

### Basic Usage

```bash
node load-tester.js --url https://example.com --requests 1000
```

or

```bash
node load-tester.js --url https://example.com --requests 1000 --concurrency 4
```

### Advanced Options

```bash
node load-tester.js \
  --url https://api.example.com/endpoint \
  --requests 5000 \
  --concurrency 8 \
  --batch-size 50 \
  --method POST \
  --header "Content-Type: application/json" \
  --header "Authorization: Bearer token123" \
  --data '{"key": "value"}' \
  --timeout 5000
```

### Available Options

| Option | Description | Default |
|--------|-------------|---------|
| `-u, --url <url>` | Target URL | http://127.0.0.1:5500/ |
| `-n, --requests <number>` | Total number of requests | 5000 |
| `-c, --concurrency <number>` | Number of concurrent workers | CPU count |
| `-b, --batch-size <number>` | Requests per batch | 50 |
| `-t, --timeout <number>` | Request timeout in ms | 30000 |
| `-m, --method <method>` | HTTP method | GET |
| `-H, --header <header>` | Request headers (can be used multiple times) | {} |
| `-d, --data <data>` | Request body data | null |
| `-k, --insecure` | Allow insecure TLS connections | false |
| `-f, --follow-redirects` | Follow HTTP redirects | true |
| `-r, --max-redirects <number>` | Maximum number of redirects | 5 |

## Programmatic Usage

You can also use LoadHawk as a module in your own Node.js applications:

```javascript
import runLoadTest from './load-tester.js';

// Configure your test
const config = {
  url: 'https://api.example.com/endpoint',
  totalRequests: 1000,
  concurrency: 4,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer token123'
  },
  body: JSON.stringify({ key: 'value' })
};

// Run the test
runLoadTest(config);
```

## Responsible Usage

This tool is designed for legitimate load testing purposes only. Please ensure you:

- Only test systems you own or have explicit permission to test
- Start with small request volumes and gradually increase
- Monitor the system being tested to prevent service disruption
- Consider the impact on shared resources and infrastructure

## License

MIT