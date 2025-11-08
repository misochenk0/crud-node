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