import {createUser, deleteUser, getUser, listUsers, updateUser} from './store'

const mockId = '32a1cca4-d219-426d-9870-9781e9c3af39'
jest.mock('uuid', () => ({ v4: () => mockId }));


const mockUser = { username: 'Alex', age: 18, hobbies: ['football'] }

describe('users store', () => {

    afterAll(() => {
        jest.clearAllMocks()
    })
    test('should add user to store', () => {
        expect(createUser(mockUser)).toEqual({
            ...mockUser,
            id: mockId,
        })
    })

    test('shold return user if id exists', () =>{
        expect(getUser(mockId)).toEqual({ ...mockUser, id: mockId })
        expect(getUser('1234')).toBeUndefined()
    })

    test('should return array of users', () => {
        expect(listUsers()).toEqual([{
            ...mockUser,
            id: mockId,
        }])
    })

    test('shold update user if id exists', () => {
        const newUser = { ...mockUser, age: 20 }
        expect(updateUser(mockId, newUser)).toEqual({ ...newUser, id: mockId })
        expect(updateUser('213123', newUser)).toBeUndefined()
        expect(getUser(mockId)).toEqual({ ...newUser, id: mockId })
    })

    test('shold remove user if id exists', () => {
        deleteUser(mockId)
        expect(getUser(mockId)).toBeUndefined()
        expect(listUsers()).toEqual([])
    })
});