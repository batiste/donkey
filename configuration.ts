import { createBasicAuthMiddleware } from './middlewares/basicAuth';
import { createCorsMiddleware } from './middlewares/cors';
import { createRateLimitationMiddleware } from './middlewares/rateLimit';
import { createRemoveHeadersMiddleware } from './middlewares/removeHeaders';
import { Config, IMatcher } from './schema';

export function getConfig(): Config {

  const headersToRemove = ['x-authenticated-scope', 'x-consumer-username']

  const limitByUrl = createRateLimitationMiddleware({
    keysLimits: (clientRequest) => [{
      key: (clientRequest.url as string),
      limit: 3
    }]
  })

  const matchers: IMatcher[] = [
    // load test config
    {
      hosts: ['loadtest'],
      upstream: 'backend',
      port: 8000,
      timeout: 3,
      requestMiddlewares: [
        createRemoveHeadersMiddleware(headersToRemove),
      ]
    },
    // basic auth
    {
      hosts: ['localhost:3000'],
      upstream: 'example.com',
      uris: ['/admin/'],
      requestMiddlewares: [createBasicAuthMiddleware('admin', '1234')],
      stripUri: true,
    },
    // basic
    {
      hosts: ['localhost:3000'],
      upstream: 'example.com',
      protocol: 'https:',
      port: 443,
      requestMiddlewares: [limitByUrl],
      responseMiddlewares: [createCorsMiddleware('http://example.com')]
    },
    // test
    {
      hosts: ['example.com'],
      upstream: 'example.com',
      timeout: 2
    },
    {
      hosts: ['thing.google'],
      upstream: 'about.google',
      uris: ['/products/', '/commitments/'],
      timeout: 3
    },
  ]
  
  return { matchers }
}
