import { isUuidV4, validateUserBody } from './validation'
import { v4 } from 'uuid'

describe('Validation id TESTS', () => {
    test('Random String as id should be falsy', () => {
        expect(isUuidV4('asdasd')).toBeFalsy()
    })
    test('UUID v4 should pass validation', () => {
        expect(isUuidV4(v4())).toBeTruthy()
    })
})

describe('Validation body TESTS', () => {
    test('Invalid body should fail with error', () => {
        const error = { ok: false, message: 'Body must be an object' }
        expect(validateUserBody(null)).toEqual(error)
        expect(validateUserBody('dadad')).toEqual(error)
    })
    test('Invalid username should fail with error', () => {
        const error = { ok: false, message: 'username must be a non-empty string' }
        expect(validateUserBody({ username: null })).toEqual(error)
        expect(validateUserBody({ username: '' })).toEqual(error)
        expect(validateUserBody({ username: 1 })).toEqual(error)
        expect(validateUserBody({})).toEqual(error)
    })
    test('Invalid age should fail with error', () => {
        const error = { ok: false, message: 'age must be a non-negative number' }
        expect(validateUserBody({ username: 'Test' })).toEqual(error)
        expect(validateUserBody({ username: 'Test', age: null })).toEqual(error)
        expect(validateUserBody({ username: 'Test', age: -15 })).toEqual(error)
    })
    test('Invalid hobbies should fail with error', () => {
        const error = { ok: false, message: 'hobbies must be an array of strings' }
        expect(validateUserBody({ username: 'Test', age: 19, hobbies: null })).toEqual(error)
        expect(validateUserBody({ username: 'Test', age: 19 })).toEqual(error)
        expect(validateUserBody({ username: 'Test', age: 19, hobbies: [1, 2, 3] })).toEqual(error)
        expect(validateUserBody({ username: 'Test', age: 19, hobbies: [false] })).toEqual(error)
    })
    test('valid body should pass validation', () => {
        const value = { username: 'Test', age: 19, hobbies: ['football', 'basketball'] }
        expect(validateUserBody(value)).toEqual({ ok: true, value })

    })
})