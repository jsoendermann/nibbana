import { Lock } from 'semaphore-async-await'
import axios from 'axios'
import freshId from 'fresh-id'
const merge = require('lodash.merge')

import * as asyncStorageUtils from './asyncStorageUtils'
import { Severity, Entry, NibbanaConfig, IAsyncStorage } from './types'

const ASYNC_STORAGE_KEY = 'com.primlo.nibbana.logEntries'
const NO_CONFIG_ERROR_MESSAGE = '[nibbana] You must call nibbana.configure before any other methods'

// Since there's no way to atomically execute array operations on AsyncStorage,
// we need to synchronize our access to avoid race conditions.
const entriesLock = new Lock()

// This is to avoid having multiple uploads run in parallel which would cause
// entries to be logged multiple times
const uploadLock = new Lock()

let config: NibbanaConfig | null = null

// These are added to each entry
let superProperties: object = {}

let automaticUploadsIntervalId: number | null = null

const defaultValuesForOptionalConfigValues: Partial<NibbanaConfig> = {
  outputToConsole: (global as any).process.env.NODE_ENV !== 'production',
  capacity: 0,
  additionalHTTPHeaders: () => ({}),
  uploadEntries: (entries: Entry[]) =>
    axios({
      method: 'POST',
      url: config!.endpoint,
      data: { secretToken: config!.secretToken, entries },
      headers: config!.additionalHTTPHeaders,
      timeout: 15 * 1000,
    }),
}

/**
 * Configures nibbana with the given configuration. Must be called at least once before any other function is called.
 * 
 * @param newConfig Your configuration
 */
export const configure = (newConfig: Partial<NibbanaConfig>) => {
  if (newConfig.uploadEntries && newConfig.additionalHTTPHeaders) {
    throw new Error(
      '[nibbana] You can not set both uploadEntries and ' +
        'additionalHTTPHeaders since using your own uploadEntries function ' +
        'means you have to take care of http headers yourself.',
    )
  }

  if (newConfig.uploadEntries && newConfig.endpoint) {
    throw new Error(
      '[nibbana] You can not set both a custom uploadEntries function and an' +
        'endpoint since using your own uploadEntries function ' +
        'means you have to take care of uploading yourself.',
    )
  }
  if (!newConfig.uploadEntries && !newConfig.endpoint) {
    throw new Error(
      '[nibbana] You must provide an endpoint if you are not using ' +
        'a custom uploadEntries function.',
    )
  }

  if (newConfig.uploadEntries && newConfig.secretToken) {
    throw new Error(
      '[nibbana] You can not set both a custom uploadEntries function and a ' +
        'secretToken since using your own uploadEntries function ' +
        'means you have to take care of the secretToken yourself.',
    )
  }
  if (!newConfig.uploadEntries && !newConfig.secretToken) {
    throw new Error(
      '[nibbana] You must provide a secretToken if you are not using ' +
        'a custom uploadEntries function.',
    )
  }

  const defaultValuesCopy = { ...defaultValuesForOptionalConfigValues }
  config = merge(defaultValuesCopy, newConfig)

  // We have to handle this separately so that we can require 'react-native'
  // down here instead of at the top which causes problems when running
  // in a non-react-native environment such as tests.
  if (!config!.asyncStorage) {
    const { AsyncStorage } = require('react-native')
    config!.asyncStorage = AsyncStorage
  }
}

/**
 * Sets your super properties. Super properties get saved with every entry.
 * @param newSuperProperties The new super properties
 */
export const setSuperProperties = (newSuperProperties: object) => {
  clearSuperProperties()
  extendSuperProperties(newSuperProperties)
}

/**
 * Extends your existing super properties
 * @param additionalSuperProperties An object to be merged into your super properties
 */
export const extendSuperProperties = (additionalSuperProperties: object) =>
  merge(superProperties, additionalSuperProperties)

/**
 * Resets all super properties
 */
export const clearSuperProperties = () => {
  superProperties = {}
}

const appendEntry = async (severity: Severity, data: any[]) => {
  if (config === null) {
    throw new Error(NO_CONFIG_ERROR_MESSAGE)
  }

  const entryData = data.map(datum => {
    if (datum instanceof Error) {
      return {
        message: datum.message,
        name: datum.name,
        stack: datum.stack,
      }
    }

    return datum
  })

  const newEntry: Partial<Entry> = {
    _id: freshId(15),
    severity,
    occurredAt: new Date(),
    superProperties,
    data: entryData,
  }

  await entriesLock.acquire()
  try {
    await asyncStorageUtils.enqueueWithCapacity(
      config.asyncStorage,
      ASYNC_STORAGE_KEY,
      newEntry,
      config.capacity,
    )
  } finally {
    entriesLock.release()
  }
}

/**
 * Clears all locally saved log entries.
 */
export const clearEntries = async () => {
  if (config === null) {
    throw new Error(NO_CONFIG_ERROR_MESSAGE)
  }

  await entriesLock.acquire()
  try {
    await config.asyncStorage.removeItem(ASYNC_STORAGE_KEY)
  } finally {
    entriesLock.release()
  }
}

const newEntry = async (severity: Severity, data: any[]) => {
  if (config === null) {
    throw new Error(NO_CONFIG_ERROR_MESSAGE)
  }

  if (config.outputToConsole) {
    ;(console as any)[severity](...data)
  }

  return appendEntry(severity, data)
}

/**
 * Use this instead of console.log.
 * @param data What to log. Can be a string or an Error.
 */
export const log = async (...data: any[]) => newEntry('log', data)
/**
 * Use this instead of console.warn.
 * @param data What to log. Can be a string or an Error.
 */
export const warn = async (...data: any[]) => newEntry('warn', data)
/**
 * Use this instead of console.debug.
 * @param data What to log. Can be a string or an Error.
 */
export const debug = async (...data: any[]) => newEntry('debug', data)
/**
 * Use this instead of console.error.
 * @param data What to log. Can be a string or an Error.
 */
export const error = async (...data: any[]) => newEntry('error', data)

/**
 * This forces an upload of all locally saved log entries
 */
export const uploadNow = async () => {
  if (config === null) {
    throw new Error(NO_CONFIG_ERROR_MESSAGE)
  }

  await uploadLock.acquire()
  try {
    const entriesToBeUploaded = await asyncStorageUtils.getArray(
      config.asyncStorage,
      ASYNC_STORAGE_KEY,
    )
    if (entriesToBeUploaded.length === 0) {
      return
    }

    await config.uploadEntries(entriesToBeUploaded)

    const idsOfUploadedEntries: string[] = entriesToBeUploaded.map((e: Entry) => e._id)

    await entriesLock.acquire()
    try {
      await asyncStorageUtils.filterArray(
        config.asyncStorage,
        ASYNC_STORAGE_KEY,
        e => !idsOfUploadedEntries.includes(e._id),
      )
    } finally {
      entriesLock.release()
    }
  } finally {
    uploadLock.release()
  }
}

/**
 * This starts periodic uploads of locally saved entries in the background
 * @param frequencyInSeconds The upload frequency in seconds. Don't set this to a value too low.
 */
export const startAutomaticUploads = (frequencyInSeconds: number = 5 * 60) => {
  if (automaticUploadsIntervalId !== null) {
    console.log(`[nibbana] automatic uploads already in progress`)
    return
  }
  automaticUploadsIntervalId = setInterval(uploadNow, frequencyInSeconds * 1000)
}

/**
 * This stops periodic background uploads
 */
export const stopAutomaticUploads = () => {
  if (automaticUploadsIntervalId !== null) {
    clearInterval(automaticUploadsIntervalId)
  }
}
