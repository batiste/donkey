import * as http from 'http';
import { Config, IMatcher } from './schema';

const defaut_timeout = 30

function matchUris(uris: string[], url: string) {
  for(let i=0; i < uris.length; i++) {
    if(url.startsWith(uris[i])) { return true }
  }
  return false
}

export function match(matchers: IMatcher[], clientRequest: http.IncomingMessage): IMatcher | undefined {
  for(let i=0; i < matchers.length; i++) {
    const matcher = matchers[i]
    if (matcher.hosts && !matcher.hosts.includes(clientRequest.headers.host as string)) {
      continue
    }
    if (matcher.uris && !matchUris(matcher.uris, clientRequest.url as string)) {
      continue
    }
    return matcher
  }
  return 
}

export function matcherToOptions(
    clientRequest: http.IncomingMessage,
    matcher: IMatcher,
    config: Config) : http.RequestOptions {
  return {
    host: matcher.upstream,
    port: matcher.port || 80,
    path: clientRequest.url,
    protocol: matcher.protocol || 'http:',
    method: clientRequest.method,
    headers: clientRequest.headers,
    timeout: (matcher.timeout || config.defaultTimeout || 30) * 1000,
  };
}