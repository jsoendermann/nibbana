import { NibbanaEntry } from './NibbanaEntry'
import { IAsyncStorage } from 'react-native-async-storage-utils'

export type UploadEntriesFunction = (entries: NibbanaEntry[]) => Promise<any>

export interface NibbanaConfig {
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
