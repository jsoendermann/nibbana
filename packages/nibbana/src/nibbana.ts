import freshId from 'fresh-id'
import axios from 'axios'
import {
  IAsyncStorage,
  getObject,
  getArray,
  setValue,
  enqueue,
  filterArray,
} from 'react-native-async-storage-utils'
import { merge, debounce } from 'lodash'
import { Lock } from 'semaphore-async-await'
import { NibbanaEvent, NibbanaUserEvent } from 'nibbana-types'

import { NibbanaConfig } from './NibbanaConfig'

const NIBBANA_VERSION = require('../package.json').version

const ASYNC_STORAGE_USER_IDENTIFICATION_KEY = 'nibbana.userIdentification'
const ASYNC_STORAGE_USERS_FIRST_IDENTIFIED_AT = 'nibbana.usersFirstIdentifiedAt'
const ASYNC_STORAGE_PERSISTENT_SUPER_PROPERTIES_KEY =
  'nibbana.persistentSuperProperties'
const ASYNC_STORAGE_EVENTS_KEY = 'nibbana.events'

const UPLOAD_TIMEOUT = 15 * 1000
const UPLOAD_INTERVAL = 60 * 1000

export default class Nibbana {
  private static _shared: Nibbana | null = null
  private config: NibbanaConfig | null = null
  private userIdentification: string | null = null

  private uploadLock = new Lock()
  private entriesLock = new Lock()

  private transientSuperProperties: any = {}
  private persistentSuperProperties: any = {}

  private startTimerCalledAtDates: any = {}

  constructor() {
    if (Nibbana._shared) {
      throw new Error('The Nibbana class is a singleton')
    }

    setInterval(() => this.uploadEvents(), UPLOAD_INTERVAL)

    Nibbana._shared = this
  }

  public static shared() {
    if (Nibbana._shared) {
      return Nibbana._shared
    } else {
      return new Nibbana()
    }
  }

  private ensureConfig(): NibbanaConfig {
    if (!this.config) {
      throw new Error(
        'You have to call nibbana.initialize before any other method',
      )
    }
    return this.config
  }

  public async initialize(endpoint: string, nibbanaToken: string) {
    const { AsyncStorage } = require('react-native')

    this.config = {
      asyncStorage: AsyncStorage,
      uploadEntries: (events: NibbanaEvent[]) =>
        axios({
          method: 'POST',
          url: endpoint,
          data: { events },
          headers: {
            'nibbana-token': nibbanaToken,
          },
          timeout: UPLOAD_TIMEOUT,
        }).catch(() => null),
    }

    this.persistentSuperProperties = await getObject(
      this.config.asyncStorage,
      ASYNC_STORAGE_PERSISTENT_SUPER_PROPERTIES_KEY,
    )
    this.userIdentification = await this.config.asyncStorage.getItem(
      ASYNC_STORAGE_USER_IDENTIFICATION_KEY,
    )

    return this.uploadEvents()
  }

  // _initializeWithConfig

  public async identify(userIdentification: string) {
    const config = this.ensureConfig()

    if (!userIdentification) {
      throw new Error('userIdentification must not be falsy')
    }

    await config.asyncStorage.setItem(
      ASYNC_STORAGE_USER_IDENTIFICATION_KEY,
      userIdentification,
    )

    const usersFirstIdentifiedAt: any = await getObject(
      config.asyncStorage,
      ASYNC_STORAGE_USERS_FIRST_IDENTIFIED_AT,
    )
    if (!usersFirstIdentifiedAt[userIdentification]) {
      usersFirstIdentifiedAt[userIdentification] = new Date()
      await setValue(
        config.asyncStorage,
        ASYNC_STORAGE_USERS_FIRST_IDENTIFIED_AT,
        usersFirstIdentifiedAt,
      )
    }
  }

  public async setSuperProperties(superProperties: object, persistent = false) {
    const config = this.ensureConfig()

    if (persistent) {
      merge(this.persistentSuperProperties, superProperties)

      for (const key of Object.keys(superProperties)) {
        delete this.transientSuperProperties[key]
      }
    } else {
      merge(this.transientSuperProperties, superProperties)

      for (const key of Object.keys(superProperties)) {
        delete this.persistentSuperProperties[key]
      }
    }

    await setValue(
      config.asyncStorage,
      ASYNC_STORAGE_PERSISTENT_SUPER_PROPERTIES_KEY,
      this.persistentSuperProperties,
    )
  }

  public async unsetSuperProperty(superPropertyName: string) {
    const config = this.ensureConfig()

    delete this.transientSuperProperties[superPropertyName]
    delete this.persistentSuperProperties[superPropertyName]
    await setValue(
      config.asyncStorage,
      ASYNC_STORAGE_PERSISTENT_SUPER_PROPERTIES_KEY,
      this.persistentSuperProperties,
    )
  }

  public async trackEvent(name: string, payload: object) {
    const config = this.ensureConfig()

    const event: NibbanaUserEvent = {
      _id: freshId(),
      occurredAt: new Date(),
      type: 'USER_EVENT',
      eventName: name,
      eventPayload: payload,
      userIdentification: this.userIdentification,
      superProperties: {
        ...this.persistentSuperProperties,
        ...this.transientSuperProperties,
      },
      context: {
        nibbanaVersion: NIBBANA_VERSION,
      },
    }

    if (this.startTimerCalledAtDates[name]) {
      event.duration = +new Date() - +this.startTimerCalledAtDates[name]
      delete this.startTimerCalledAtDates[name]
    }

    await this.entriesLock.acquire()
    try {
      await enqueue(config.asyncStorage, ASYNC_STORAGE_EVENTS_KEY, event)
    } finally {
      this.entriesLock.release()
    }

    this.uploadEvents()
  }

  startTimerForEvent(eventName: string) {
    this.startTimerCalledAtDates[eventName] = new Date()
  }

  clearTimerForEvent(eventName: string) {
    delete this.startTimerCalledAtDates[eventName]
  }

  private async uploadEvents() {
    if (!this.config) {
      return
    }

    await this.uploadLock.acquire()
    try {
      const eventsToBeUploaded = await getArray(
        this.config.asyncStorage,
        ASYNC_STORAGE_EVENTS_KEY,
      )
      if (eventsToBeUploaded.length === 0) {
        return
      }

      await this.config.uploadEntries(eventsToBeUploaded)

      const idsOfUploadedEntries: string[] = eventsToBeUploaded.map(
        (e: NibbanaEvent) => e._id,
      )

      await this.entriesLock.acquire()
      try {
        await filterArray(
          this.config.asyncStorage,
          ASYNC_STORAGE_EVENTS_KEY,
          e => !idsOfUploadedEntries.includes(e._id),
        )
      } finally {
        this.entriesLock.release()
      }
    } finally {
      this.uploadLock.release()
    }
  }
}
