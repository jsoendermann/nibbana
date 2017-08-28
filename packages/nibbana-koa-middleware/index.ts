export default () => async (ctx: any, next: Function) => {
  console.log(ctx.request.body)
  next()
}
