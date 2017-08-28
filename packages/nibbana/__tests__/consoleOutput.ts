import AsyncStorageMock from './utils/AsyncStorageMock'

describe('console logging', () => {
  it('should log normally in dev mode', async () => {
    const globalObject = global as any

    // This is necessary to reset NODE_ENV in nibbana module
    jest.resetModules()
    globalObject.process.env.NODE_ENV = 'development'
    const nibbana = require('../src').default

    const log = console.log
    console.log = jest.fn()

    nibbana.configure({
      uploadEntries: () => null,
      asyncStorage: new AsyncStorageMock(),
    })

    nibbana.log('DEV')

    expect(console.log).toHaveBeenCalled()
    console.log = log
  })

  it('should not log in production mode', async () => {
    const globalObject = global as any

    // This is necessary to reset NODE_ENV in nibbana module
    jest.resetModules()
    globalObject.process.env.NODE_ENV = 'production'
    const nibbana = require('../src').default

    const spy = jest.spyOn(globalObject.console, 'log')

    nibbana.configure({
      uploadEntries: () => null,
      asyncStorage: new AsyncStorageMock(),
    })

    nibbana.log('PROD')

    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('should respect outputToConsole', async () => {
    const globalObject = global as any

    // This is necessary to reset NODE_ENV in nibbana module
    jest.resetModules()
    globalObject.process.env.NODE_ENV = 'development'
    const nibbana = require('../src').default

    const spy = jest.spyOn(globalObject.console, 'log')

    nibbana.configure({
      outputToConsole: false,
      uploadEntries: () => null,
      asyncStorage: new AsyncStorageMock(),
    })

    nibbana.log('DEV AGAIN')

    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})