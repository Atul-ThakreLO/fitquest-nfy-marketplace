import { Elysia } from 'elysia'
import { bearer } from '@elysiajs/bearer'
import config from '../config'

/**
 * Elysia plugin that validates the Bearer token on any route using this plugin.
 * Used to protect admin/org-only endpoints.
 */
export const authMiddleware = new Elysia({ name: 'auth' })
  .use(bearer())
  .onBeforeHandle({ as: 'scoped' }, ({ bearer: token, status }) => {
    console.log(token);
    if (!token || token !== config.adminApiSecret) {
      return status(401, { success: false, message: 'Unauthorized: invalid or missing Bearer token' })
    }
    return
  })
