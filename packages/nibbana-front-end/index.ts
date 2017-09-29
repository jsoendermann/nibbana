import axios from 'axios'
import { Observable } from 'rxjs'

/**
 * Runs the given aggregation pipeline on the nibbana collection on the server and returns a promise of the result.
 * 
 * @param endpoint This should be the same as the endpoint you use in your app.
 * @param apiSecret You app secret. THIS IS NOT THE SAME AS YOUR NIBBANA TOKEN.
 * @param pipeline The aggregation pipeline that computes your result. This will be passed to mongo's aggregate function.
 */
export const evaluate = async (
  endpoint: string,
  apiSecret: string,
  pipeline: object[],
): Promise<any[]> =>
  axios({
    method: 'POST',
    url: `${endpoint}/run-pipeline`,
    headers: {
      'nibbana-api-secret': apiSecret,
    },
    data: {
      pipeline,
    },
    maxContentLength: 50 * 1000 * 1000 * 1000,
  }).then(d => d.data as any[])

/**
 * Starts polling your server, running the given aggregation pipeline at every iteration. This function returns an observable.
 * 
 * @param endpoint This should be the same as the endpoint you use in your app.
 * @param apiSecret You app secret. THIS IS NOT THE SAME AS YOUR NIBBANA TOKEN.
 * @param pipeline The aggregation pipeline that computes your result. This will be passed to mongo's aggregate function. Note that this will be executed at each iteration so if it's computationally expensive, don't set your polling interval too low.
 * @param interval The polling interval.
 */
export const poll = (
  endpoint: string,
  apiSecret: string,
  pipeline: object[],
  interval: number,
): Observable<any[]> =>
  Observable.interval(interval).mergeMap(() =>
    evaluate(endpoint, apiSecret, pipeline),
  )
