# Donkey, an API gateway in less than 500 lines of code

A configuration based gateway with minimal features written in TypeScript
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

