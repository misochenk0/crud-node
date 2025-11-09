import { createServer, IncomingMessage, ServerResponse, request } from 'http'
import cluster from 'node:cluster'
import { availableParallelism } from 'node:os'
import { v4 } from 'uuid'
import 'dotenv/config'
import { readJson, sendError, sendJson } from './utils/json'
import { isUuidV4, validateUserBody } from './users/validation'
import { errorValidationResponse, okValidationResponse, User, UserInput } from './types/index'
import { Server } from "node:net"

const BASE_PORT = Number(process.env.PORT) || 4000
const MODE = process.env.MODE || 'single'
const PORT = Number(process.env.PORT) || BASE_PORT
const default_path = '/api/users'

let users = new Map<string, User>()

interface CRUDRequest {
    type: 'list' | 'get' | 'create' | 'update' | 'delete'
    id?: string
    value?: UserInput
    requestId: string
}

interface CRUDResponse {
    status: number
    data?: any
    requestId: string
}

if (MODE === 'multi' && cluster.isPrimary) {
    const count = Math.max(1, availableParallelism() - 1)
    const targets = Array.from({ length: count }, (_, i) => BASE_PORT + i + 1)
    let index = 0

    for (const port of targets) cluster.fork({ ...process.env, PORT: String(port) })

    cluster.on('message', (worker, msg: CRUDRequest) => {
        if (!msg || !msg.type || !msg.requestId) return

        let res: CRUDResponse = { requestId: msg.requestId, status: 500 }

        try {
            switch (msg.type) {
                case 'list':
                    res = { ...res, status: 200, data: Array.from(users.values()) }
                    break
                case 'get':
                    if (!msg.id) break
                    const user = users.get(msg.id)
                    res = { ...res, status: user ? 200 : 404, data: user }
                    break
                case 'create':
                    if (!msg.value) break
                    const newUser: User = { id: v4(), ...msg.value }
                    users.set(newUser.id, newUser)
                    res = { ...res, status: 201, data: newUser }
                    break
                case 'update':
                    if (!msg.id || !msg.value) break
                    if (!users.has(msg.id)) {
                        res = { ...res, status: 404 }
                        break
                    }
                    const updated: User = { id: msg.id, ...msg.value }
                    users.set(msg.id, updated)
                    res = { ...res, status: 200, data: updated }
                    break
                case 'delete':
                    if (!msg.id) break
                    const ok = users.delete(msg.id)
                    res = { ...res, status: ok ? 204 : 404 }
                    break
            }
        } catch (err) {
            res = { ...res, status: 500, data: (err as Error).message }
        }

        worker.send(res)
    })

    const balancer = createServer((req, res) => {
        const target = targets[index]
        index = (index + 1) % targets.length

        const proxy = request(
            { hostname: '127.0.0.1', port: target, path: req.url, method: req.method, headers: req.headers },
            (proxyRes) => {
                res.setHeader('X-Worker-Port', target)
                res.writeHead(proxyRes.statusCode || 502, proxyRes.headers)
                proxyRes.pipe(res)
            }
        )

        proxy.on('error', (err) => {
            res.writeHead(502)
            res.end(`Bad Gateway: ${err.message}`)
        })

        req.pipe(proxy)
    })

    balancer.listen(BASE_PORT, () => console.log(`Balancer listening on http://localhost:${BASE_PORT}`))
}

async function handleCrud(msg: CRUDRequest): Promise<CRUDResponse> {
    if (MODE === 'single' || !cluster.isWorker) {
        let res: CRUDResponse = { requestId: msg.requestId, status: 500 }
        try {
            switch (msg.type) {
                case 'list':
                    res = { ...res, status: 200, data: Array.from(users.values()) }
                    break
                case 'get':
                    if (!msg.id) break
                    const user = users.get(msg.id)
                    res = { ...res, status: user ? 200 : 404, data: user }
                    break
                case 'create':
                    if (!msg.value) break
                    const newUser: User = { id: v4(), ...msg.value }
                    users.set(newUser.id, newUser)
                    res = { ...res, status: 201, data: newUser }
                    break
                case 'update':
                    if (!msg.id || !msg.value) break
                    if (!users.has(msg.id)) {
                        res = { ...res, status: 404 }
                        break
                    }
                    const updated: User = { id: msg.id, ...msg.value }
                    users.set(msg.id, updated)
                    res = { ...res, status: 200, data: updated }
                    break
                case 'delete':
                    if (!msg.id) break
                    const ok = users.delete(msg.id)
                    res = { ...res, status: ok ? 204 : 404 }
                    break
            }
        } catch (err) {
            res = { ...res, status: 500, data: (err as Error).message }
        }
        return res
    } else {
        return new Promise((resolve) => {
            process.send!(msg)
            const listener = (resp: CRUDResponse) => {
                if (resp.requestId === msg.requestId) {
                    process.removeListener('message', listener)
                    resolve(resp)
                }
            }
            process.on('message', listener)
        })
    }
}

let server: Server

export async function createServerInstance(port: number = PORT) {
    server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
        try {
            const url = new URL(req.url || '/', `http://${req.headers.host}`)
            if (!url.pathname.startsWith(default_path)) return sendError(res, 404, 'Not found')

            res.setHeader('Access-Control-Allow-Origin', '*')
            res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE')
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

            const requestId = v4()

            if (url.pathname === default_path) {
                switch (req.method) {
                    case 'GET': {
                        const resp = await handleCrud({ type: 'list', requestId })
                        return sendJson(res, resp.status, resp.data)
                    }
                    case 'POST': {
                        const body = await readJson(req)
                        const parsed: okValidationResponse | errorValidationResponse = validateUserBody(body)
                        if (!parsed.ok) return sendError(res, 400, (parsed as errorValidationResponse).message)
                        const resp = await handleCrud({ type: 'create', value: parsed.value, requestId })
                        return sendJson(res, resp.status, resp.data)
                    }
                }
            }

            const id = url.pathname.split('/').pop()!
            if (!isUuidV4(id)) return sendError(res, 400, 'Invalid user id (must be UUID v4)')

            switch (req.method) {
                case 'GET': {
                    const resp = await handleCrud({ type: 'get', id, requestId })
                    return resp.data ? sendJson(res, resp.status, resp.data) : sendError(res, resp.status, 'User not found')
                }
                case 'PUT': {
                    const body = await readJson(req)
                    const parsed = validateUserBody(body)
                    if (!parsed.ok) return sendError(res, 400, (parsed as errorValidationResponse).message)
                    const resp = await handleCrud({ type: 'update', id, value: parsed.value, requestId })
                    return resp.data ? sendJson(res, resp.status, resp.data) : sendError(res, resp.status, 'User not found')
                }
                case 'DELETE': {
                    const resp = await handleCrud({ type: 'delete', id, requestId })
                    return resp.status === 204 ? sendJson(res, 204) : sendError(res, resp.status, 'User not found')
                }
            }
        } catch (err) {
            return sendError(res, 500, 'Internal Server Error')
        }
    })

    await new Promise<void>((resolve) => server.listen(port, resolve))
}

if (MODE === 'single' || cluster.isWorker) createServerInstance(PORT)

export { server }