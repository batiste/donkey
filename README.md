# 🐴 Donkey is a configuration based API Gateway

A configuration based gateway with minimal features written in TypeScript.
Can replace Kong for basic purposes.

## Core Features

  * APIs gateway (discriminate by host and url, or apply rules globally)
  * CORS headers middleware
  * Remove headers middleware
  * Basic Auth middleware
  * Metadata middleware (redis)
  * Rate limitation middleware (redis)
  * Authentication middleware
## Run the server locally

You will need a redis server running on localhost

```bash
npm install
npm run serve
```

Or

```
docker compose build donkey
docker compose up donkey
```

Or

```bash
docker build . -t donkey
docker run -p 3000:3000 donkey
```

## Configuration

APIs configuration in Donkey works with a list of conditional IMatcher.
Each IMatcher is taken in order and the `hosts` and `uris` fields are tested with the current incoming request.
The IMatcher is used for this request if the provided fields match.
If no fields are present the IMatcher is always used.

```ts
import { createBasicAuthMiddleware } from './middlewares/basicAuth';
import { Config, IMatcher } from './schema';

export function getConfig(): Config {
  const matchers: IMatcher[] = [
    // match the HTTP header Host: loadtest
    {
      hosts: ['loadtest'],
      upstream: 'localhost',
      port: 8000,
      timeout: 3
    },
    // match HTTP header Host: localhost and the /admin/ uri
    {
      hosts: ['localhost'],
      upstream: 'example.com',
      // at least one uris should match. The match is done with startsWith
      uris: ['/admin/'],
      requestMiddlewares: [createBasicAuthMiddleware('admin', '1234')],
    },
    // match any leftover requests
    {
      upstream: 'example.com',
    },
  ]
  return { matchers }
}
```

## IMatcher options

```ts
export interface IMatcher {
  /**
   * Upstream domain, with no protocol, no path
   */
  upstream: string
  /**
   * Port to use on the upstream, default is 80
   */
  port?: number
  /**
   * List of hosts to check
   */
  hosts?: string[]
  /**
   * List of uris to match. String.startsWith is used
   */
  uris?: string[]
  /**
   * Protocol to use on the upstream. Default http
   */
  protocol?: 'http:' | 'https:'
  /**
   * Timeout when the gateway give up on the upstream
   */
  timeout?: number
  /**
   * All middleware to apply on the client request or response
   */
  requestMiddlewares?: RequestMiddleware[]
  /**
   * All middleware to apply on the upstream response
   */
  responseMiddlewares?: ResponseMiddleware[]
  /**
   * Preserve the original host from the client
   */
  preserveHost?: boolean
  /**
   * Remove the matched uri from the rest of the uri
   */
  stripUri?: boolean
}
```

## Performance and scalability

Load test with artillery, core usage ~15%

```yaml
config:
  target: "http://localhost:3000"
  phases:
    - duration: 60
      arrivalRate: 100
scenarios:
  - flow:
      - get:
          url: "/test"
          headers:
            host: loadtest
```

Backend with 0ms latency

```yaml
Summary report @ 10:16:08(+0200) 2021-06-24
  Scenarios launched:  6000
  Scenarios completed: 6000
  Requests completed:  6000
  Mean response/sec: 99.16
  Response time (msec):
    min: 0
    max: 52
    median: 1
    p95: 2
    p99: 3
  Scenario counts:
    0: 6000 (100%)
  Codes:
    200: 6000
```

Backend with 200ms latency

```yaml
Summary report @ 10:09:00(+0200) 2021-06-24
  Scenarios launched:  6000
  Scenarios completed: 6000
  Requests completed:  6000
  Mean response/sec: 99.16
  Response time (msec):
    min: 200
    max: 256
    median: 202
    p95: 203
    p99: 225
  Scenario counts:
    0: 6000 (100%)
  Codes:
    200: 6000
```


