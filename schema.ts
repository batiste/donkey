
export interface IMatcher {
  upstream: string
  port?: number
  host?: string
  uris?: string[]
  protocol?: string
  timeout?: number
  middleware?: Function
}

export interface Config {
  matchers: IMatcher[]
}
