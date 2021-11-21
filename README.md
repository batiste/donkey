# 🐴 Donkey is a configuration based API Gateway

A configuration based gateway with a decent array of features written in TypeScript.
Can replace Kong for basic purposes.

## Core Features

  * APIs gateway
    * The configuration is based on a TypeScript function called at runtime
    * Match host and URL to upstream using strings or regular expressions
    * Apply middleware by match
    * Apply middleware globally
  * Rate limitation middleware (uses redis)
  * JWT verification middleware (rotating secrets, payload decoding and forwading)
  * CORS headers middleware
  * Remove headers middleware
  * Basic Auth middleware
  * Metadata middleware (can be used to fetch extra data for a user, organization or anything else specific about the request, uses redis)
  * Authentication middleware


## Install

```bash
npm install donkey-gateway
```

## Use the boilerplace project

If you wish to use Donkey directly, we recommend to use [the example project](https://github.com/batiste/donkey-boilerplate)

```bash
git clone git@github.com:batiste/donkey-boilerplate.git
cd donkey-boilerplate
docker compose up
```

## Run the dev server locally

You will need a redis server running on localhost

```bash
npm install
# on another process, you might need to run the test backend
node tests/backend.js
npm run serve
```

Or

```
docker compose up donkey-dev
```

Or

```bash
docker build . -t donkey-dev
docker run -p 3000:3000 donkey-dev
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
      hosts: ['localhost:3000'],
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
   * Upstream domain, with no protocol and no path.
   */
  upstream: string;
  /**
   * Port to use on the upstream. The default is 80.
   */
  port?: number;
  /**
   * List of hosts to match.
   */
  hosts?: (string | RegExp)[];
  /**
   * List of uris to match. String.startsWith is used for the match.
   * A RegExp can also be provided. If stripeUri is true, the first capturing
   * parenthesis will be used. If none present the whole match will be used.
   */
  uris?: (string | RegExp)[];
  /**
   * Protocol to use on the upstream. The default is http.
   */
  protocol?: "http:" | "https:";
  /**
   * Timeout when the gateway give up on the upstream. There is a default
   * of 30 seconds.
   */
  timeout?: number;
  /**
   * All middleware to apply on the client request or response.
   */
  requestMiddlewares?: RequestMiddleware[];
  /**
   * All middleware to apply on the upstream response.
   */
  responseMiddlewares?: ResponseMiddleware[];
  /**
   * Preserve the original host from the client. The default is false.
   */
  preserveHost?: boolean;
  /**
   * Remove the matched path from the rest of the URI. E.g.
   * If the matcher path is /admin/ and the incoming request is /admin/user/123
   * the uri used on the upstream will become /user/123. As leading slash is enforced.
   * The default is false.
   */
  stripeUri?: boolean;
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


