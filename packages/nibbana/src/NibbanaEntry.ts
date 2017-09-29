export interface NibbanaEntry {
  _id: string
  occurredAt: Date
  type: 'EVENT' | 'ERROR' | 'IDENTIFY'

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

export interface NibbanaLoggedError extends NibbanaEntry {
  type: 'ERROR'

  message: string
  name: string
  stack: string | null

  payload: object
}

export interface NibbanaIdentify extends NibbanaEntry {
  type: 'IDENTIFY'
}
