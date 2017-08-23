import AsyncStorageMock from './utils/AsyncStorageMock'
import nibbana from '../src'

describe('configuration', () => {
  it('should not let you configure both uploadEntries and additionalHTTPHeaders', () => {
    expect(() =>
      nibbana.configure({
        uploadEntries: () => null,
        additionalHTTPHeaders: () => null,
      }),
    ).toThrow()
  })

  it('should not let you configure both uploadEntries and endpoint', () => {
    expect(() =>
      nibbana.configure({
        uploadEntries: () => null,
        endpoint: 'arst',
      }),
    ).toThrow()
  })

  it('should require an endpoint when uploadEntries is not set', () => {
    expect(() =>
      nibbana.configure({
        endpoint: 'INVALID',
      }),
    ).toThrow()
  })

  it('should not let you configure both uploadEntries and secretToken', () => {
    expect(() =>
      nibbana.configure({
        uploadEntries: () => null,
        secretToken: 'MY_TOKEN',
      }),
    ).toThrow()
  })

  it('should require a secretToken when uploadEntries is not set', () => {
    expect(() =>
      nibbana.configure({
        endpoint: 'INVALID',
      }),
    ).toThrow()
  })

  it('should accept a valid configuration', () => {
    expect(() =>
      nibbana.configure({
        endpoint: 'INVALID',
        secretToken: 'myMimi',
        capacity: 42,
        asyncStorage: new AsyncStorageMock(),
      }),
    ).not.toThrow()
  })

  it('should make you call configure first', async () => {
    jest.resetModules()
    const nibbana = require('../src').default
    const l = nibbana.log('arst')
    await expect(l).rejects.toBeInstanceOf(Error)
  })
})
