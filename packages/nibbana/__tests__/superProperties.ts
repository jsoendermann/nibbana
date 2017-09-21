import { NibbanaEvent } from 'nibbana-types'
import { AsyncStorageMock } from 'react-native-async-storage-utils'

import nibbana from '../src'

describe('super properties', () => {
  it('should have empty default super properties', () => {
    nibbana.configureWithCustomUploadFunction({
      outputToConsole: false,
      uploadEntries: async (entries: Entry[]) => {
        expect(entries[0].superProperties).toEqual({})
      },
      asyncStorage: new AsyncStorageMock(),
    })
    nibbana.log('test')
    nibbana.uploadNow()
  })

  it('should set super properties', () => {
    nibbana.configureWithCustomUploadFunction({
      outputToConsole: false,
      uploadEntries: async (entries: Entry[]) => {
        expect(entries[0].superProperties).toEqual({ foo: 'bar' })
      },
      asyncStorage: new AsyncStorageMock(),
    })
    nibbana.setSuperProperties({ foo: 'bar' })
    nibbana.log('test')
    nibbana.uploadNow()
  })

  it('should extends super properties', () => {
    nibbana.configureWithCustomUploadFunction({
      outputToConsole: false,
      uploadEntries: async (entries: Entry[]) => {
        expect(entries[0].superProperties).toEqual({ foo: 'bar', abc: 'def' })
      },
      asyncStorage: new AsyncStorageMock(),
    })
    nibbana.setSuperProperties({ foo: 'bar' })
    nibbana.extendSuperProperties({ abc: 'def' })
    nibbana.log('test')
    nibbana.uploadNow()
  })

  it('should clear super properties', () => {
    nibbana.configureWithCustomUploadFunction({
      outputToConsole: false,
      uploadEntries: async (entries: Entry[]) => {
        expect(entries[0].superProperties).toEqual({})
      },
      asyncStorage: new AsyncStorageMock(),
    })
    nibbana.setSuperProperties({ foo: 'bar' })
    nibbana.clearSuperProperties()
    nibbana.log('test')
    nibbana.uploadNow()
  })
})
