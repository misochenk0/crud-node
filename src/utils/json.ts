import { IncomingMessage, ServerResponse } from 'http'

export async function readJson<T = unknown>(req: IncomingMessage): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let data = ''
    req
      .on('data', (chunk) => {
        data += chunk
      })
      .on('end', () => {
        if (!data) {
          resolve(undefined as unknown as T)
          return
        }
        try {
          const json = JSON.parse(data)
          resolve(json)
        } catch (e) {
          reject(new Error('Invalid JSON'))
        }
      })
      .on('error', (err) => reject(err))
  })
}

export function sendJson(res: ServerResponse, status: number, payload?: unknown) {
  const body = payload === undefined ? '' : JSON.stringify(payload)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Content-Length', Buffer.byteLength(body).toString())
  res.end(body)
}

export function sendError(res: ServerResponse, status: number, message: string) {
  sendJson(res, status, { message })
}
