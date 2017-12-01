export interface NibbanaEntry {
  _id: string
  occurredAt: Date
  type: 'EVENT' | 'ERROR' | 'JS_CRASH'

  userIdentification: string | null

  superProperties: object
  // context: object
}

export interface NibbanaEvent extends NibbanaEntry {
  type: 'EVENT'

  name: string
  payload: object

  duration?: number
}

export interface NibbanaError extends NibbanaEntry {
  type: 'ERROR'

  message: string
  name: string
  stack: string | null

  payload: object
}

export interface NibbanaJSCrash extends NibbanaEntry {
  type: 'JS_CRASH'

  message: string
  name: string
  stack: string | null

  payload: object
}
