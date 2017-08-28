import { Entry } from 'nibbana-types'
import { IAsyncStorage } from 'react-native-async-storage-utils'

export type UploadEntriesFunction = (entries: Entry[]) => Promise<any>

export interface NibbanaConfig {
  /**
   * Whether besides uploading entries, we should also write to the console.
   */
  outputToConsole: boolean

  /**
   * The url at which nibbana-server is reachable.
   * 
   * @type {string}
   * @memberof NibbanaConfig
   */
  endpoint: string

  /**
   * Must be the same as on the server or your uploads will fail.
   * 
   * @type {string}
   * @memberof NibbanaConfig
   */
  secretToken: string

  /**
   * If this is set to a value greater than 0, our local entries store is turned into a bounded queue that discards old entries once we reach our capacity. Be careful with this setting.
   * 
   * @type {number}
   * @memberof NibbanaConfig
   */
  capacity: number

  /**
   * If you leave this.uploadEntries set to its default value, these http headers will be added to your request.
   * 
   * @memberof NibbanaConfig
   */
  additionalHTTPHeaders: () => any

  /**
   * Use this when you want to provide your own uploading logic. Make sure your requests time out after a reasonable amount of time.
   * 
   * @memberof NibbanaConfig
   */
  uploadEntries: UploadEntriesFunction

  /**
   * Used for testing. You should probably not fiddle with this.
   * 
   * @type {IAsyncStorage}
   * @memberof NibbanaConfig
   */
  asyncStorage: IAsyncStorage
}
