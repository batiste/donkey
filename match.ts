import * as http from 'http';
import * as config from './configuration'

const defaut_timeout = 30

function matchUris(uris: string[], url: string) {
  for(let i=0; i < uris.length; i++) {
    if(url.startsWith(uris[i])) { return true }
  }
  return false
}

export function match(clientRequest: http.IncomingMessage): config.IMatcher | undefined {
  console.log(clientRequest.headers.host)
  for(let i=0; i < config.matchers.length; i++) {
    const matcher = config.matchers[i]
    if (matcher.host && clientRequest.headers.host != matcher.host) {
      continue
    }
    if (matcher.uris && !matchUris(matcher.uris, clientRequest.url as string)) {
      continue
    }
    return matcher
  }
  return 
}

export function matcherToOptions(clientRequest: http.IncomingMessage, matcher: config.IMatcher) : http.RequestOptions {
  return {
    host: matcher.upstream,
    port: matcher.port || 80,
    path: clientRequest.url,
    protocol: matcher.protocol || 'http:',
    method: clientRequest.method,
    headers: clientRequest.headers,
    timeout: (matcher.timeout || defaut_timeout) * 1000,
  };
}