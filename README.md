# Donkey, an API gateway in less than 500 lines of code

A configuration based gateway with minimal features written in TypeScript.
Can replace Kong for basic purposes.
## Run the server

```bash
npm install
npm run serve
```

## Configuration

APIs configuration in Donkey works with a list of conditional IMatcher.
Each IMatcher is taken in order and the host and uris are tested with the current incoming request.
If there is a match with both fields the IMatcher is used.
If neither host or uris is provided the corresponding IMatcher is always used.

```ts
import { basicAuthMiddleware } from './middlewares/basicAuth';
import { Config, IMatcher } from './schema';

export function getConfig(): Config {
  const matchers: IMatcher[] = [
    {
      host: 'loadtest',
      upstream: 'localhost',
      port: 8000,
      timeout: 3
    },
    // basic auth
    {
      host: 'localhost',
      upstream: 'example.com',
      uris: ['/admin/'],
      middleware: basicAuthMiddleware,
    },
    // otherwise alway go here
    {
      upstream: 'example.com',
    },
  ]
  return { matchers }
}
```

## Implemented

  * APIs gateway
  * cors headers
  * Request transformer (removing certain headers, such as OAuth2 scopes headers)
  * Basic auth middleware
## Missing features

  * Authentication middlewares?


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


