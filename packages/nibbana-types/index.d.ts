export interface NibbanaEvent {
  _id: string
  occurredAt: Date
  type: 'USER_EVENT'

  userIdentification: string | null

  superProperties: object
  context: object
}

export interface NibbanaUserEvent extends NibbanaEvent {
  type: 'USER_EVENT'
  eventName: string
  eventPayload: object

  duration?: number
}
