import { basicAuthMiddleware } from './middlewares/basicAuth';

export interface IMatcher {
  upstream: string
  port?: number
  host?: string
  uris?: string[]
  protocol?: string
  timeout?: number
  middleware?: Function
}

export const globalMiddlewares = [
]

export const matchers: IMatcher[] = [
  // basic auth
  {
    host: 'localhost:3000',
    upstream: 'example.com',
    uris: ['/admin/'],
    middleware: basicAuthMiddleware,
    timeout: 2
  },
  // basic
  {
    host: 'localhost:3000',
    upstream: 'example.com',
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
