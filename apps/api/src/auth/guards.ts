import { fromNodeHeaders } from 'better-auth/node'
import type { NextFunction, Request, RequestHandler, Response } from 'express'

import { sendError } from '../errors'
import type { MarketplaceAuth } from './config'

export type AuthSession = NonNullable<Awaited<ReturnType<MarketplaceAuth['api']['getSession']>>>

declare global {
  namespace Express {
    interface Request {
      authSession?: AuthSession
    }
  }
}

/** Resolve the cookie-backed session for a protected application route. */
export function requireAuth(auth: MarketplaceAuth): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) })
      if (!session) {
        sendError(res, {
          code: 'UNAUTHENTICATED',
          message: 'Authentication is required',
          status: 401,
        })
        return
      }

      req.authSession = session
      next()
    } catch (error) {
      next(error)
    }
  }
}

/** Role checks are exact matches; role names carry no implicit hierarchy. */
export function requireRole(...allowedRoles: AuthSession['user']['role'][]): RequestHandler {
  if (allowedRoles.length === 0) {
    throw new TypeError('requireRole needs at least one allowed role')
  }

  return (req, res, next) => {
    const role = req.authSession?.user.role
    if (!role) {
      sendError(res, {
        code: 'UNAUTHENTICATED',
        message: 'Authentication is required',
        status: 401,
      })
      return
    }

    if (!allowedRoles.includes(role)) {
      sendError(res, {
        code: 'FORBIDDEN',
        message: 'You do not have permission to access this resource',
        status: 403,
      })
      return
    }

    next()
  }
}
