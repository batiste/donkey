import { createBasicAuthMiddleware } from './middlewares/basicAuth';
import { createCorsMiddleware } from './middlewares/cors';
import { createRemoveHeadersMiddleware } from './middlewares/removeHeaders';
import { Config, IMatcher } from './schema';

export function getConfig(): Config {

  const headersToRemove = ['x-authenticated-scope', 'x-consumer-username']

  const matchers: IMatcher[] = [
    // load test config
    {
      host: 'loadtest',
      upstream: 'localhost',
      port: 8000,
      timeout: 3,
      requestMiddlewares: [createRemoveHeadersMiddleware(headersToRemove)]
    },
    // basic auth
    {
      host: 'localhost:3000',
      upstream: 'example.com',
      uris: ['/admin/'],
      requestMiddlewares: [createBasicAuthMiddleware('admin', '1234')],
    },
    // basic
    {
      host: 'localhost:3000',
      upstream: 'example.com',
      protocol: 'https:',
      port: 443,
      responseMiddlewares: [createCorsMiddleware('http://example.com')]
    },
    // test
    {
      host: 'example.com',
      upstream: 'example.com',
      timeout: 2
    },
    {
      host: 'thing.google',
      upstream: 'about.google',
      uris: ['/products/', '/commitments/'],
      timeout: 3
    },
  ]
  
  return { matchers }
}
