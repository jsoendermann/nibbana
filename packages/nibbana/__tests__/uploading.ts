import { Entry } from 'nibbana-types'
import { getArray } from 'react-native-async-storage-utils'

import AsyncStorageMock from './utils/AsyncStorageMock'
import nibbana from '../src'

const ASYNC_STORAGE_KEY = 'com.primlo.nibbana.logEntries'

const wait = (ms: number) => new Promise(r => setTimeout(r, ms))

describe('should upload', async () => {
  it('should log the severity level', async () => {
    const asyncStorage = new AsyncStorageMock()
    nibbana.configureWithCustomUploadFunction({
      outputToConsole: false,
      uploadEntries: async (entries: Entry[]) => {
        expect(entries).toHaveLength(3)
      },
      asyncStorage,
    })

    await nibbana.log(new Error('foobar'))
    await nibbana.warn(new Error('foobar'))
    await nibbana.error(new Error('foobar'))

    await nibbana.uploadNow()
  })

  it('should remove entries after uploading', async () => {
    const asyncStorage = new AsyncStorageMock()
    nibbana.configureWithCustomUploadFunction({
      outputToConsole: false,
      uploadEntries: async (entries: Entry[]) => {},
      asyncStorage,
    })

    await nibbana.log(new Error('foobar'))
    await nibbana.warn(new Error('foobar'))
    await nibbana.error(new Error('foobar'))

    await nibbana.uploadNow()

    const localEntries = await getArray(asyncStorage, ASYNC_STORAGE_KEY)

    expect(localEntries).toHaveLength(0)
  })

  it('should not allow overlapping uploads', async () => {
    let isFirstUpload = true
    let beforeUploads = new Date()
    const asyncStorage = new AsyncStorageMock()
    nibbana.configureWithCustomUploadFunction({
      outputToConsole: false,
      uploadEntries: async (entries: Entry[]) => {
        await wait(500)
        if (isFirstUpload) {
          isFirstUpload = false
        } else {
          expect(+new Date() - +beforeUploads).toBeGreaterThan(1000)
        }
      },
      asyncStorage,
    })

    await nibbana.log(new Error('foobar'))
    await nibbana.warn(new Error('foobar'))
    await nibbana.error(new Error('foobar'))
    const p1 = nibbana.uploadNow()
    nibbana.log(new Error('foobar'))
    const p2 = nibbana.uploadNow()
    await Promise.all([p1, p2])
  })
})
