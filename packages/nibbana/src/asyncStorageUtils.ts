import { IAsyncStorage } from './types'

export const getArray = async (asyncStorage: IAsyncStorage, key: string): Promise<any[]> => {
  const str = await asyncStorage.getItem(key)
  return JSON.parse(str || '[]')
}

export const setArray = async (asyncStorage: IAsyncStorage, key: string, value: any[]) => {
  const str = JSON.stringify(value)
  return asyncStorage.setItem(key, str)
}

export const filterArray = async (
  asyncStorage: IAsyncStorage,
  key: string,
  predicate: (o: any) => boolean,
) => {
  const array = await getArray(asyncStorage, key)
  const updatedArray = array.filter(predicate)
  setArray(asyncStorage, key, updatedArray)
}

export const enqueueWithCapacity = async (
  asyncStorage: IAsyncStorage,
  key: string,
  value: any,
  capacity: number,
) => {
  const array = await getArray(asyncStorage, key)
  const updatedArray = [...array, value].slice(-capacity)
  return setArray(asyncStorage, key, updatedArray)
}
