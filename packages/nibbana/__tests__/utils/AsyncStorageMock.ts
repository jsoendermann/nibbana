import { IAsyncStorage } from 'react-native-async-storage-utils'

// TODO(jan): Move this to react-native-async-storage-utils
export default class AsyncStorageMock implements IAsyncStorage {
  public data = {}

  public getItem(
    key: string,
    callback?: (error?: Error, result?: string) => void,
  ): Promise<string> {
    return this.data[key]
  }

  public setItem(key: string, value: string, callback?: (error?: Error) => void): Promise<void> {
    this.data[key] = value
    return
  }

  public removeItem(key: string, callback?: (error?: Error) => void): Promise<void> {
    delete this.data[key]
    return
  }
}
