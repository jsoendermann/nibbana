// TODO(jan): take secret

export default () => async (ctx: any, next: Function) => {
  console.log(ctx.request.body)
  await next()
}
