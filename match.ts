import * as http from 'http';
import { Config, IMatch, IMatcher, IMatcherCriteria } from './schema';

function matchUris(uris: string[], url: string): string | false {
  for(let i=0; i < uris.length; i++) {
    if(url.startsWith(uris[i])) { return uris[i] }
  }
  return false
}

export function matchRequest(matchers: IMatcher[], clientRequest: http.IncomingMessage): IMatch | undefined {
  for(let i=0; i < matchers.length; i++) {
    const matcher = matchers[i]
    const criteria: IMatcherCriteria = {}
    if (matcher.hosts) {
      if (matcher.hosts.includes(clientRequest.headers.host as string)) {
        criteria['host'] = clientRequest.headers.host
      } else {
        continue
      }
    }
    if (matcher.uris) {
      const uri = matchUris(matcher.uris, clientRequest.url as string)
      if (uri) {
        criteria['uri'] = uri
      } else {
        continue
      }
    }
    return { matcher, criteria }
  }
  return 
}

export function matcherToOptions(
    clientRequest: http.IncomingMessage,
    match: IMatch,
    config: Config) : http.RequestOptions {
  const matcher = match.matcher
  let url = clientRequest.url as string
  if (matcher.stripUri && match.criteria.uri) {
    url = url.substr(match.criteria.uri.length)
    if (!url.startsWith('/')) { url = '/' + url}
  }
  return {
    host: matcher.upstream,
    port: matcher.port || 80,
    path: url,
    protocol: matcher.protocol || 'http:',
    method: clientRequest.method,
    headers: clientRequest.headers,
    timeout: (matcher.timeout || config.defaultTimeout || 30) * 1000,
  };
}