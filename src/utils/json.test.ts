import { readJson, sendJson, sendError } from './json'
import { Readable } from 'stream'
import type { IncomingMessage, ServerResponse } from 'http'

function makeReq(body?: string): IncomingMessage {
  const req = new Readable({ read() {} }) as IncomingMessage
  if (body !== undefined) {
    req.push(body)
  }
  req.push(null)
  return req
}

class MockResponse {
  public statusCode = 200
  public headers: Record<string, string> = {}
  public endedBody: string | undefined

  setHeader(name: string, value: string) {
    this.headers[name.toLowerCase()] = String(value)
  }
  end(chunk?: any) {
    this.endedBody = chunk?.toString() ?? ''
  }
}

describe('readJson', () => {
  test('parses valid JSON body', async () => {
    const data = { a: 1, b: 'c' }
    const request = makeReq(JSON.stringify(data))
    await expect(readJson(request)).resolves.toEqual(data)
  })

  test('returns undefined for empty body', async () => {
    const req = makeReq()
    await expect(readJson(req)).resolves.toBeUndefined()
  })

  test('rejects on invalid JSON', async () => {
    const req = makeReq('dasdasdsad')
    await expect(readJson(req)).rejects.toThrow('Invalid JSON')
  })
})

describe('sendJson and sendError', () => {
  test('sendJson sets status, and body with payload', () => {
    const res = new MockResponse() as unknown as ServerResponse
    const payload = { ok: true, num: 5 }
    sendJson(res, 201, payload)
    const mock = res as unknown as MockResponse
    expect(res.statusCode).toBe(201)
    expect(mock.endedBody).toBe(JSON.stringify(payload))
  })

  test('sendJson with undefined payload sends empty body', () => {
    const res = new MockResponse() as unknown as ServerResponse
    sendJson(res, 204)
    const mock = res as unknown as MockResponse
    expect(mock.statusCode).toBe(204)
    expect(mock.endedBody).toBe('')
  })

  test('sendError delegates to sendJson with message payload', () => {
    const res = new MockResponse() as unknown as ServerResponse
    sendError(res, 400, 'Bad input')

    const mock = res as unknown as MockResponse
    expect(mock.statusCode).toBe(400)
    expect(mock.endedBody).toBe(JSON.stringify({ message: 'Bad input' }))
  })
})