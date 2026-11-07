import { handleApi } from '../lib/http.mjs'

export default function handler(req, res) {
  return handleApi(req, res, 'deployments')
}
