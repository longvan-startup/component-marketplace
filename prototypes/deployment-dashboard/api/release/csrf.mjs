import { handleRelease } from '../../lib/release-http.mjs'

export default function handler(req, res) {
  return handleRelease(req, res)
}
