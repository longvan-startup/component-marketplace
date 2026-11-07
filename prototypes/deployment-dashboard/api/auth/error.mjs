import { handleAuth } from '../../lib/auth.mjs'

export default function handler(req, res) {
  return handleAuth(req, res)
}
