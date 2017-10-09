import * as Koa from 'koa'
import * as Router from 'koa-router'
import * as cors from 'kcors'
import * as bodyParser from 'koa-bodyparser'
import { Collection } from 'mongodb'
const { parse } = require('extended-json-js')

export default (
  getCollection: () => Promise<Collection>,
  nibbanaToken: string,
  apiSecret: string,
) => {
  const router = new Router()

  router.use(bodyParser())
  router.use(cors())
  router.use(async (ctx: Koa.Context, next: () => PromiseLike<any>) => {
    ctx.response.type = 'application/json;charset=UTF-8'
    await next()
  })

  router.post('/run-pipeline', async (ctx: Koa.Context) => {
    console.log('Executing nibbana pipeline...')

    const requestApiSecret = ctx.request.headers['nibbana-api-secret']
    if (requestApiSecret !== apiSecret) {
      ctx.throw(403, 'Incorrect secret')
    }

    const { pipelineString } = ctx.request.body
    if (!pipelineString) {
      ctx.throw(400, 'pipelineString is falsy')
    }

    const pipeline = parse(pipelineString)

    const collection = await getCollection()
    const result = await collection.aggregate(pipeline).toArray()

    ctx.body = result
  })

  router.post('/upload-entries', async (ctx: Koa.Context) => {
    console.log('Saving nibbana entries...')

    const requestNibbanaToken = ctx.request.headers['nibbana-token']
    if (requestNibbanaToken !== nibbanaToken) {
      ctx.throw(403, 'Incorrect token')
    }

    const collection = await getCollection()

    const entriesString = ctx.request.body.entriesString
    if (!entriesString) {
      return
    }

    const entries = parse(entriesString)

    for (const entry of entries) {
      await collection.update({ _id: entry._id }, entry, { upsert: true })
    }
  })

  const app = new Koa()
  app.use(cors())
  app.use(router.routes()).use(router.allowedMethods())

  return app
}
