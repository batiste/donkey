import { matchHosts, matchUris } from "../match";


describe('matchUris', () => {

  it('matchUris', async () => {
    expect(matchUris(['/admin/'], '/admin')).toEqual(false)
    expect(matchUris(['/admin'], '/admin')).toEqual('/admin')
    expect(matchUris(['/admin'], '/admin/hello')).toEqual('/admin')
    expect(matchUris([/^(\/admin)\/.*/], '/admin/hello')).toEqual('/admin')
  });

});

describe('matchHosts', () => {

  it('matchHosts', async () => {
    expect(matchHosts(['example.com', 'test.com'], 'test.com')).toEqual('test.com')
    expect(matchHosts(['example.com', 'test.com'], 'test1.com')).toEqual(false)
    expect(matchHosts(['example.com', /^(.*)\.com/], 'test1.com')).toEqual('test1.com')
  });

});