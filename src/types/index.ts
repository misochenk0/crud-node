export interface UserInput {
    username: string
    age: number
    hobbies: string[]
}

export interface User extends UserInput {
    id: string
}

export type okValidationResponse = { ok: true; value: { username: string; age: number; hobbies: string[] } }
export type errorValidationResponse = { ok: false; message: string }

export enum modes {
    single = 'single',
    multi = 'multi'
}

export enum messages {
    list = 'list',
    get = 'get',
    create = 'create',
    update = 'update',
    delete = 'delete'
}

export interface CRUDRequest {
    type: messages
    id?: string
    value?: UserInput
    requestId: string
}

export interface CRUDResponse {
    status: number
    data?: any
    requestId: string
}