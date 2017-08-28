// TODO(jan): Add nibbana-types to dependencies
// TODO(jan): Think of some way to log the place in the code the log occurred in

import { Lock } from 'semaphore-async-await'
import axios from 'axios'
import freshId from 'fresh-id'
const merge = require('lodash.merge')
import { Severity, Entry } from 'nibbana-types'
import * as asyncStorageUtils from 'react-native-async-storage-utils'

import { UploadEntriesFunction, NibbanaConfig } from './types'

export const ASYNC_STORAGE_KEY = 'com.primlo.nibbana.logEntries'
const NO_CONFIG_ERROR_MESSAGE = '[nibbana] You must call nibbana.configure before any other methods'

declare const global: any
const { NODE_ENV } = global.process.env

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

export interface ConfigureProps {
  endpoint: string
  // TODO(jan): Rename this to nibbanaToken
  secretToken: string
  capacity?: number
  additionalHTTPHeaders?: () => any
  asyncStorage?: asyncStorageUtils.IAsyncStorage
  outputToConsole?: boolean
}
export const configure = (props: ConfigureProps) => {
  let capacity: number
  if (props.capacity == null) {
    capacity = 0
  } else {
    capacity = props.capacity
  }

  let additionalHTTPHeaders = props.additionalHTTPHeaders || (() => ({}))

  let asyncStorage: asyncStorageUtils.IAsyncStorage
  if (props.asyncStorage) {
    asyncStorage = props.asyncStorage
  } else {
    const { AsyncStorage } = require('react-native')
    asyncStorage = AsyncStorage
  }

  let outputToConsole: boolean
  if (props.outputToConsole == null) {
    outputToConsole = NODE_ENV !== 'production'
  } else {
    outputToConsole = props.outputToConsole
  }

  const uploadEntries = (entries: Entry[]) => {
    const headers = additionalHTTPHeaders()
    return axios({
      method: 'POST',
      url: props.endpoint,
      data: { secretToken: props.secretToken, entries },
      headers,
      timeout: 15 * 1000,
    })
  }

  config = {
    uploadEntries,
    asyncStorage,
    outputToConsole,
    capacity,
  }
}

export interface ConfigureWithCustomUploadFunctionProps {
  uploadEntries: UploadEntriesFunction
  capacity?: number
  asyncStorage?: asyncStorageUtils.IAsyncStorage
  outputToConsole?: boolean
}
export const configureWithCustomUploadFunction = (
  props: ConfigureWithCustomUploadFunctionProps,
) => {
  let capacity: number
  if (props.capacity == null) {
    capacity = 0
  } else {
    capacity = props.capacity
  }

  let asyncStorage: asyncStorageUtils.IAsyncStorage
  if (props.asyncStorage) {
    asyncStorage = props.asyncStorage
  } else {
    const { AsyncStorage } = require('react-native')
    asyncStorage = AsyncStorage
  }

  let outputToConsole: boolean
  if (props.outputToConsole == null) {
    outputToConsole = NODE_ENV !== 'production'
  } else {
    outputToConsole = props.outputToConsole
  }

  config = {
    uploadEntries: props.uploadEntries,
    asyncStorage,
    outputToConsole,
    capacity,
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

const consoleProps = {
  log: console.log,
  warn: console.warn,
  debug: console.debug,
  error: console.error,
}

const newEntry = async (severity: Severity, data: any[]) => {
  if (config === null) {
    throw new Error(NO_CONFIG_ERROR_MESSAGE)
  }

  if (config.outputToConsole) {
    consoleProps[severity](...data)
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
