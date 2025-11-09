import { IncomingMessage, ServerResponse } from 'http'
import { createServer } from 'node:http'
import 'dotenv/config'
import { readJson, sendError, sendJson } from './utils/json'
import { createUser, deleteUser, getUser, listUsers, updateUser } from './users/store'
import { isUuidV4, validateUserBody } from './users/validation'
import {errorValidationResponse, okValidationResponse} from './types/index'

const PORT = Number(process.env.PORT) || 3000
const default_path = '/api/users'

function notFound(res: ServerResponse) {
  sendError(res, 404, 'Not found')
}

function isApiUsersPath(pathname?: string) {
  return pathname === default_path || pathname?.startsWith(`${default_path}/`)
}

export const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  try {
    const url: URL = new URL(req.url || '/', `http://${req.headers.host}`)

    if (!isApiUsersPath(url.pathname)) return notFound(res)

    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (url.pathname === default_path) {
        switch (req.method) {
            case 'GET':
                return sendJson(res, 200, listUsers())
            case 'POST': {
                const body = await readJson(req)
                const parsed: okValidationResponse | errorValidationResponse = validateUserBody(body)
                if (!parsed.ok) return sendError(res, 400, (parsed as errorValidationResponse)?.message)
                const created = createUser(parsed.value)
                return sendJson(res, 201, created)
            }
        }
    }

    const id = url.pathname.split('/').pop() as string
    if (!isUuidV4(id)) return sendError(res, 400, 'Invalid user id (must be UUID v4)')

      switch (req.method) {
          case 'GET': {
              const user = getUser(id)
              return user ? sendJson(res, 200, user) : sendError(res, 404, 'User not found')
          }
          case 'PUT': {
              const body = await readJson(req)
              const parsed = validateUserBody(body)
              if (!parsed.ok) return sendError(res, 400, (parsed as errorValidationResponse).message)
              const updated = updateUser(id, parsed.value)
              return updated ? sendJson(res, 200, updated) : sendError(res, 404, 'User not found')
          }
          case 'DELETE': {
              const ok = deleteUser(id)
              return ok ? sendJson(res, 204) : sendError(res, 404, 'User not found')
          }
      }

  } catch (err) {
    console.error(err)
    return sendError(res, 500, 'Internal Server Error')
  }
})

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`)
})

process.on('SIGINT', () => {
  server.close(() => process.exit(0))
})
process.on('SIGTERM', () => {
  server.close(() => process.exit(0))
})
