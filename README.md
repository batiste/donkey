# Donkey, an API gateway in less than 500 lines of code

A configuration based gateway with minimal features written in TypeScript.
Can replace Kong for basic purposes.
## Run the server

```bash
npm install
npm run serve
```

## Implemented

  * APIs gateway
  * cors headers
  * Request transformer (removing certain headers, such as OAuth2 scopes headers)
  * Basic auth middleware
## Missing features

  * Authentication middlwares?


## Performance and scalability

Load test with artillery

```yaml
config:
  target: "http://localhost:3000"
  phases:
    - duration: 20
      arrivalRate: 100
scenarios:
  - flow:
      - get:
          url: "/test"
          headers:
            host: loadtest
```

Output

```yaml
Summary report @ 09:50:20(+0200) 2021-06-24
  Scenarios launched:  2000
  Scenarios completed: 2000
  Requests completed:  2000
  Mean response/sec: 97.61
  Response time (msec):
    min: 1
    max: 342
    median: 3
    p95: 13.5
    p99: 169
  Scenario counts:
    0: 2000 (100%)
  Codes:
    200: 2000
```

