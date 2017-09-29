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
import { get, merge, debounce } from 'lodash'
import { Lock } from 'semaphore-async-await'
import {
  NibbanaEntry,
  NibbanaEvent,
  NibbanaLoggedError,
  NibbanaIdentify,
} from './NibbanaEntry'

import { NibbanaConfig } from './NibbanaConfig'

const NIBBANA_VERSION = require('../package.json').version
let APP_VERSION: string | null = null
try {
  const appPackageJson = require('../../../package.json')
  APP_VERSION = get(appPackageJson, 'version', null)
} catch (e) {}

const ASYNC_STORAGE_USER_IDENTIFICATION_KEY = 'nibbana.userIdentification'
const ASYNC_STORAGE_USERS_FIRST_IDENTIFIED_AT = 'nibbana.usersFirstIdentifiedAt'
const ASYNC_STORAGE_PERSISTENT_SUPER_PROPERTIES_KEY =
  'nibbana.persistentSuperProperties'
const ASYNC_STORAGE_ENTRIES_KEY = 'nibbana.entries'

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

    Nibbana._shared = this
  }

  /**
   * Returns the Nibbana instance. You shouldn't have to call this function, in fact you shouldn't even have access to it
   * 
   * @static
   * @returns The shared nibbana instance
   * @memberof Nibbana
   */
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

  /**
   * Initializes nibbana and starts auto uploads. You have to call this function before you can do pretty much anything else. Don't call it more than once though, it'll throw!
   * 
   * @param {string} endpoint The endpoint at which you are running the nibbana-koa-middleware, e.g. https://my.server.examle.com/nibbana
   * @param {string} nibbanaToken Your nibbana token. THIS IS NOT YOUR API SECRET!
   * @returns {Promise<void>} 
   * @memberof Nibbana
   */
  public async initialize(endpoint: string, nibbanaToken: string): Promise<void>
  /**
   * Initializes nibbana with a NibbanaConfig. This is meant for testing, you should probably the other overload of initialize
   * 
   * @param {NibbanaConfig} config An instance of NibbanaConfig
   * @returns {Promise<void>} 
   * @memberof Nibbana
   */
  public async initialize(config: NibbanaConfig): Promise<void>
  public async initialize(...args: any[]) {
    if (this.config) {
      throw new Error('nibbana has already been initialized')
    }

    if (args.length === 1) {
      this.config = args[0]
    } else {
      const [endpoint, nibbanaToken] = args

      const { AsyncStorage, AppState } = require('react-native')

      this.config = {
        asyncStorage: AsyncStorage,
        uploadEntries: (entries: NibbanaEntry[]) =>
          axios({
            method: 'POST',
            url: `${endpoint}/upload-entries`,
            data: { entries },
            headers: {
              'nibbana-token': nibbanaToken,
            },
            timeout: UPLOAD_TIMEOUT,
          }).catch(() => null),
      }

      // AppState.addEventListener('change', (nextAppState: string) => {
      //   console.log(nextAppState)
      // })
    }

    this.persistentSuperProperties = await getObject(
      this.config!.asyncStorage,
      ASYNC_STORAGE_PERSISTENT_SUPER_PROPERTIES_KEY,
    )
    this.userIdentification = await this.config!.asyncStorage.getItem(
      ASYNC_STORAGE_USER_IDENTIFICATION_KEY,
    )

    setInterval(() => this.uploadEntries(), UPLOAD_INTERVAL)
    return this.uploadEntries()
  }

  /**
   * Identifies the current user with a unique string, such as a user id, an email address, a phone number or whatever you use to uniquely identify your users. User identification gets persisted between launches but it doesn't hurt to re-identify.
   * 
   * @param {string} userIdentification A string that uniquely identifies your user.
   * @memberof Nibbana
   */
  public async identify(userIdentification: string) {
    const config = this.ensureConfig()

    if (!userIdentification) {
      throw new Error('userIdentification must not be falsy')
    }

    this.userIdentification = userIdentification
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

    const entry: NibbanaIdentify = {
      _id: freshId(),
      occurredAt: new Date(),
      type: 'IDENTIFY',
      userIdentification,
      superProperties: {
        ...this.persistentSuperProperties,
        ...this.transientSuperProperties,
      },
    }

    await this.entriesLock.acquire()
    try {
      await enqueue(config.asyncStorage, ASYNC_STORAGE_ENTRIES_KEY, entry)
    } finally {
      this.entriesLock.release()
    }
  }

  /**
   * Sets super properties that get saved with every log entry. This function merges whatever you give you into your existing super properties. They are useful for stuff like additional information you have about your users or your environment.
   * 
   * @param {object} superProperties An object to be merged into your existing super properties.
   * @param {boolean} [persistent=false] Whether the super properties you are calling the function with should be persisted between app launches.
   * @memberof Nibbana
   */
  public async extendSuperProperties(
    superProperties: object,
    persistent = false,
  ) {
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

  /**
   * Unsets a single super property.
   * 
   * @param {string} superPropertyName The name of the property you want to delete.
   * @memberof Nibbana
   */
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

  /**
   * Resets your super properties (transient and persistent) to the empty object.
   * 
   * @memberof Nibbana
   */
  public async clearSuperProperties() {
    const config = this.ensureConfig()

    this.transientSuperProperties = {}
    this.persistentSuperProperties = {}
    await setValue(
      config.asyncStorage,
      ASYNC_STORAGE_PERSISTENT_SUPER_PROPERTIES_KEY,
      this.persistentSuperProperties,
    )
  }

  // TODO(jan): Only set this when uploading the entries
  private getContext() {
    const { NativeModules, Platform } = require('react-native')

    let locale: string | null = null
    if (Platform.OS === 'ios') {
      locale = get(NativeModules, 'SettingsManager.settings.AppleLocale', null)
    } else if (Platform.OS === 'android') {
      locale = get(NativeModules, 'I18nManager.localeIdentifier', null)
    }

    let context: any = {
      nibbanaVersion: NIBBANA_VERSION,
      locale,
    }

    try {
      const DeviceInfo = require('react-native-device-info')

      context = {
        ...context,
        isEmulator: DeviceInfo.isEmulator(),
        brand: DeviceInfo.getBrand(),
        bundleId: DeviceInfo.getBundleId(),
        deviceId: DeviceInfo.getDeviceId(),
        manufacturer: DeviceInfo.getManufacturer(),
        model: DeviceInfo.getModel(),
        systemName: DeviceInfo.getSystemName(),
        isTablet: DeviceInfo.isTablet(),
        deviceCountry: DeviceInfo.getDeviceCountry(),
        deviceLocale: DeviceInfo.getDeviceLocale(),
        systemVersion: DeviceInfo.getSystemVersion(),
        timezone: DeviceInfo.getTimezone(),
        userAgent: DeviceInfo.getUserAgent(),
        nativeAppVersion: DeviceInfo.getVersion(),
        buildNumber: DeviceInfo.getBuildNumber(),
        jsAppVersion: APP_VERSION,
      }
    } catch (e) {}

    return context
  }

  /**
   * This starts a timer for the event with the given name. The next time you call trackEvent for the event, the time between you called startTimerForEvent and the time you called trackEvent will get saved on the event as duration.
   * 
   * @param {string} eventName The event name
   * @memberof Nibbana
   */
  startTimerForEvent(eventName: string) {
    this.startTimerCalledAtDates[eventName] = new Date()
  }

  /**
   * Clears timers you set with {@link Nibbana#startTimerForEvent}.
   * 
   * @param {string} eventName The event name
   * @memberof Nibbana
   */
  clearTimerForEvent(eventName: string) {
    delete this.startTimerCalledAtDates[eventName]
  }

  /**
   * Logs an event. This function takes an optional payload parameter that can contain any additional data you want to save with the event. Even though this function is asynchronous, you shouldn't await on it.
   * 
   * @param {string} name The event name. Use something readable like "Awesome button pressed"
   * @param {object} [payload={}] Additional data you want to save with the event. This should be JSON serializable.
   * @memberof Nibbana
   */
  public async logEvent(name: string, payload: object = {}) {
    const config = this.ensureConfig()

    const event: NibbanaEvent = {
      _id: freshId(),
      occurredAt: new Date(),
      type: 'EVENT',
      name,
      payload: { ...payload },
      userIdentification: this.userIdentification,
      superProperties: {
        ...this.persistentSuperProperties,
        ...this.transientSuperProperties,
      },
    }

    if (this.startTimerCalledAtDates[name]) {
      event.duration = +new Date() - +this.startTimerCalledAtDates[name]
      this.clearTimerForEvent(name)
    }

    await this.entriesLock.acquire()
    try {
      await enqueue(config.asyncStorage, ASYNC_STORAGE_ENTRIES_KEY, event)
    } finally {
      this.entriesLock.release()
    }

    this.uploadEntries()
  }

  /**
   * Logs an error. This function takes an optional payload parameter that can contain any additional data you want to save with the event. Even though this function is asynchronous, you shouldn't await on it.
   * 
   * @param {Error} error 
   * @param {object} [payload={}] Additional data you want to save with the event. This should be JSON serializable.
   * @memberof Nibbana
   */
  async logError(error: Error, payload: object = {}) {
    const config = this.ensureConfig()

    const errorEntry: NibbanaLoggedError = {
      _id: freshId(),
      occurredAt: new Date(),
      type: 'ERROR',

      message: error.message,
      name: error.name,
      stack: error.stack || null,

      payload: { ...payload },

      userIdentification: this.userIdentification,
      superProperties: {
        ...this.persistentSuperProperties,
        ...this.transientSuperProperties,
      },
    }

    await this.entriesLock.acquire()
    try {
      await enqueue(config.asyncStorage, ASYNC_STORAGE_ENTRIES_KEY, errorEntry)
    } finally {
      this.entriesLock.release()
    }

    this.uploadEntries()
  }

  private async uploadEntries() {
    if (!this.config) {
      return
    }

    await this.uploadLock.acquire()
    try {
      const entriesToBeUploaded = await getArray(
        this.config.asyncStorage,
        ASYNC_STORAGE_ENTRIES_KEY,
      )
      if (entriesToBeUploaded.length === 0) {
        return
      }

      const context = this.getContext()

      const entriesWithContext = entriesToBeUploaded.map(e => ({
        ...e,
        context,
      }))

      await this.config.uploadEntries(entriesWithContext)

      const idsOfUploadedEntries: string[] = entriesWithContext.map(
        (e: NibbanaEvent) => e._id,
      )

      await this.entriesLock.acquire()
      try {
        await filterArray(
          this.config.asyncStorage,
          ASYNC_STORAGE_ENTRIES_KEY,
          e => !idsOfUploadedEntries.includes(e._id),
        )
      } finally {
        this.entriesLock.release()
      }
    } catch (e) {
      if (__DEV__) {
        console.log(`[nibbana] Error uploading entries: ${e.message}`)
      }
    } finally {
      this.uploadLock.release()
    }
  }
}
