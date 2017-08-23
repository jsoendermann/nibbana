import AsyncStorageMock from './utils/AsyncStorageMock'
import nibbana from '../src'
import { Entry } from '../src/types'

const wait = (ms: number) => new Promise(r => setTimeout(r, ms))

describe('automatic uploads', async () => {
  it('should upload automatically', async () => {
    jest.resetModules()
    const nibbana = require('../src').default

    const asyncStorage = new AsyncStorageMock()
    let uploads = 0
    nibbana.configure({
      outputToConsole: false,
      uploadEntries: async (entries: Entry[]) => {},
      asyncStorage,
    })

    const uploadNowMock = jest.fn()
    ;(nibbana as any).uploadNow = uploadNowMock

    nibbana.startAutomaticUploads(0.1)

    await wait(350)

    expect(uploadNowMock).toHaveBeenCalledTimes(3)

    nibbana.stopAutomaticUploads()
  })

  it('should stop uploading automatically', async () => {
    jest.resetModules()
    const nibbana = require('../src').default

    const asyncStorage = new AsyncStorageMock()
    let uploads = 0
    nibbana.configure({
      outputToConsole: false,
      uploadEntries: async (entries: Entry[]) => {},
      asyncStorage,
    })

    const uploadNowMock = jest.fn()
    ;(nibbana as any).uploadNow = uploadNowMock

    nibbana.startAutomaticUploads(0.1)
    await wait(350)

    nibbana.stopAutomaticUploads()
    await wait(150)

    expect(uploadNowMock).toHaveBeenCalledTimes(3)
  })
})
