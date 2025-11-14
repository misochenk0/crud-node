import {createServer, IncomingMessage, request, ServerResponse} from 'http'
import cluster from 'node:cluster'
import {availableParallelism} from 'node:os'
import {v4} from 'uuid'
import 'dotenv/config'
import {readJson, sendError, sendJson} from './utils/json'
import {isUuidV4, validateUserBody} from './users/validation'
import {
    CRUDRequest,
    CRUDResponse,
    errorValidationResponse,
    messages,
    modes,
    okValidationResponse,
    User
} from './types/index'
import {Server} from "node:net"

const BASE_PORT: number = Number(process.env.PORT) || 4000
const MODE: modes = process.env.MODE as modes || modes.single
const PORT: number = Number(process.env.PORT) || BASE_PORT
const default_path: string = '/api/users'

let users: Map<string, User> = new Map<string, User>()

const getResponse = (msg: CRUDRequest): CRUDResponse => {
    let res: CRUDResponse = { requestId: msg.requestId, status: 500 }

    try {
        switch (msg.type) {
            case messages.list:
                res = { ...res, status: 200, data: Array.from(users.values()) }
                break
            case messages.get:
                if (!msg.id) break
                const user: User = users.get(msg.id)
                res = { ...res, status: user ? 200 : 404, data: user }
                break
            case messages.create:
                if (!msg.value) break
                const newUser: User = { id: v4(), ...msg.value }
                users.set(newUser.id, newUser)
                res = { ...res, status: 201, data: newUser }
                break
            case messages.update:
                if (!msg.id || !msg.value) break
                if (!users.has(msg.id)) {
                    res = { ...res, status: 404 }
                    break
                }
                const updated: User = { id: msg.id, ...msg.value }
                users.set(msg.id, updated)
                res = { ...res, status: 200, data: updated }
                break
            case messages.delete:
                if (!msg.id) break
                const ok = users.delete(msg.id)
                res = { ...res, status: ok ? 204 : 404 }
                break
        }
    } catch (err) {
        res = { ...res, status: 500, data: (err as Error).message }
    }
    return res
}

if (MODE === modes.multi && cluster.isPrimary) {
    const targets: number[] = Array.from({ length: availableParallelism() - 1 }, (_: undefined, i: number): number => BASE_PORT + i + 1)
    let index: number = 0

    for (const port of targets) {
        cluster.fork({ ...process.env, PORT: String(port) })
    }

    cluster.on('message', (worker, msg: CRUDRequest): void => {
        if (!msg || !msg.type || !msg.requestId) return
        const res: CRUDResponse = getResponse(msg)
        worker.send(res)
    })

    const balancer: Server = createServer((req, res): void => {
        const target: number = targets[index]
        // Choosing first available port
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
        console.log(`Proxying request to port ${target}`)
        req.pipe(proxy)
    })

    balancer.listen(BASE_PORT, () => console.log(`Balancer listening on http://localhost:${BASE_PORT}`))
}

async function handleCrud(msg: CRUDRequest): Promise<CRUDResponse> {
    if (MODE === modes.single || !cluster.isWorker) return getResponse(msg)

    return new Promise((resolve): void => {
        process.send!(msg)
        const listener = (resp: CRUDResponse): void => {
            if (resp.requestId === msg.requestId) {
                process.removeListener('message', listener)
                resolve(resp)
            }
        }
        process.on('message', listener)
    })
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
                        const resp: CRUDResponse = await handleCrud({ type: messages.list, requestId })
                        return sendJson(res, resp.status, resp.data)
                    }
                    case 'POST': {
                        const body = await readJson(req)
                        const parsed: okValidationResponse | errorValidationResponse = validateUserBody(body)
                        if (!parsed.ok) return sendError(res, 400, (parsed as errorValidationResponse).message)
                        const resp: CRUDResponse = await handleCrud({ type: messages.create, value: parsed.value, requestId })
                        return sendJson(res, resp.status, resp.data)
                    }
                }
            }

            const id: string = url.pathname.split('/').pop()!
            if (!isUuidV4(id)) return sendError(res, 400, 'Invalid user id (must be UUID v4)')

            switch (req.method) {
                case 'GET': {
                    const resp: CRUDResponse = await handleCrud({ type: messages.get, id, requestId })
                    return resp.data ? sendJson(res, resp.status, resp.data) : sendError(res, resp.status, 'User not found')
                }
                case 'PUT': {
                    const body = await readJson(req)
                    const parsed: okValidationResponse | errorValidationResponse = validateUserBody(body)
                    if (!parsed.ok) return sendError(res, 400, (parsed as errorValidationResponse).message)
                    const resp: CRUDResponse = await handleCrud({ type: messages.update, id, value: parsed.value, requestId })
                    return resp.data ? sendJson(res, resp.status, resp.data) : sendError(res, resp.status, 'User not found')
                }
                case 'DELETE': {
                    const resp: CRUDResponse = await handleCrud({ type: messages.delete, id, requestId })
                    return resp.status === 204 ? sendJson(res, 204) : sendError(res, resp.status, 'User not found')
                }
            }
        } catch (err) {
            return sendError(res, 500, 'Internal Server Error')
        }
    })

    await new Promise<void>((resolve): Server => server.listen(port, resolve))
}

if (MODE === modes.single || cluster.isWorker) createServerInstance(PORT)

export { server }