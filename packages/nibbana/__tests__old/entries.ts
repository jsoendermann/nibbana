import { Entry } from 'nibbana-types'
import { getArray } from 'react-native-async-storage-utils'

import nibbana from '../src'
import AsyncStorageMock from './utils/AsyncStorageMock'

const ASYNC_STORAGE_KEY = 'com.primlo.nibbana.logEntries'

describe('entries', () => {
  it('should append entries', async () => {
    const asyncStorage = new AsyncStorageMock()
    nibbana.configureWithCustomUploadFunction({
      outputToConsole: false,
      uploadEntries: async (entries: Entry[]) => {},
      asyncStorage,
    })
    await nibbana.log('test')
    await nibbana.warn('bla')
    await nibbana.debug('dedede')
    await nibbana.error('blubb')

    const savedEntries = await getArray(asyncStorage, ASYNC_STORAGE_KEY)
    expect(savedEntries.length).toEqual(4)
  })

  it('should respect the queue capacity', async () => {
    const asyncStorage = new AsyncStorageMock()
    nibbana.configureWithCustomUploadFunction({
      outputToConsole: false,
      uploadEntries: async (entries: Entry[]) => {},
      asyncStorage,
      capacity: 2,
    })
    await nibbana.log('test')
    await nibbana.warn('bla')
    await nibbana.error('blubb')

    const savedEntries = await getArray(asyncStorage, ASYNC_STORAGE_KEY)
    expect(savedEntries.length).toEqual(2)
  })

  it('should log strings', async () => {
    const asyncStorage = new AsyncStorageMock()
    nibbana.configureWithCustomUploadFunction({
      outputToConsole: false,
      uploadEntries: async (entries: Entry[]) => {},
      asyncStorage,
    })

    await nibbana.log('foobar')

    const savedEntries = await getArray(asyncStorage, ASYNC_STORAGE_KEY)
    expect(savedEntries[0].data).toEqual(['foobar'])
  })

  it('should log errors', async () => {
    const asyncStorage = new AsyncStorageMock()
    nibbana.configureWithCustomUploadFunction({
      outputToConsole: false,
      uploadEntries: async (entries: Entry[]) => {},
      asyncStorage,
    })

    await nibbana.log(new TypeError('foobar'))

    const savedEntries = await getArray(asyncStorage, ASYNC_STORAGE_KEY)
    expect(savedEntries[0].data[0].message).toEqual('foobar')
    expect(savedEntries[0].data[0].name).toEqual('TypeError')
    expect(savedEntries[0].data[0].stack).not.toBeUndefined()
  })

  it('should log the date', async () => {
    const asyncStorage = new AsyncStorageMock()
    nibbana.configureWithCustomUploadFunction({
      outputToConsole: false,
      uploadEntries: async (entries: Entry[]) => {},
      asyncStorage,
    })

    await nibbana.log(new Error('foobar'))

    const savedEntries = await getArray(asyncStorage, ASYNC_STORAGE_KEY)
    expect(+new Date(savedEntries[0].occurredAt) / 1000).toBeCloseTo(+new Date() / 1000, 1)
  })

  it('should log the severity level', async () => {
    const asyncStorage = new AsyncStorageMock()
    nibbana.configureWithCustomUploadFunction({
      outputToConsole: false,
      uploadEntries: async (entries: Entry[]) => {},
      asyncStorage,
    })

    await nibbana.log(new Error('foobar'))
    await nibbana.warn(new Error('foobar'))
    await nibbana.debug(new Error('defoobar'))
    await nibbana.error(new Error('foobar'))

    const savedEntries = await getArray(asyncStorage, ASYNC_STORAGE_KEY)
    expect(savedEntries[0].severity).toEqual('log')
    expect(savedEntries[1].severity).toEqual('warn')
    expect(savedEntries[2].severity).toEqual('debug')
    expect(savedEntries[3].severity).toEqual('error')
  })

  it('should clear entries', async () => {
    const asyncStorage = new AsyncStorageMock()
    nibbana.configureWithCustomUploadFunction({
      outputToConsole: false,
      uploadEntries: async (entries: Entry[]) => {},
      asyncStorage,
    })

    await nibbana.log(new Error('foobar'))
    await nibbana.warn(new Error('foobar'))
    await nibbana.error(new Error('foobar'))
    await nibbana.clearEntries()

    const savedEntries = await getArray(asyncStorage, ASYNC_STORAGE_KEY)
    expect(savedEntries).toHaveLength(0)
  })
})
