import * as Koa from 'koa'
import * as mount from 'koa-mount'
import * as bodyParser from 'koa-bodyparser'

import nibbanaMiddleware from 'nibbana-koa-middleware'

const app = new Koa()

app.use(bodyParser())

app.use(mount('/nibbana', nibbanaMiddleware()))

app.listen(9723)
