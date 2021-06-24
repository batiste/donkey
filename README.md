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

Output

```yaml
Summary report @ 10:01:41(+0200) 2021-06-24
  Scenarios launched:  6000
  Scenarios completed: 6000
  Requests completed:  6000
  Mean response/sec: 99.19
  Response time (msec):
    min: 0
    max: 1035
    median: 2
    p95: 10
    p99: 478
  Scenario counts:
    0: 6000 (100%)
  Codes:
    200: 6000
```

