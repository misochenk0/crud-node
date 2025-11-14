import * as request from 'supertest';
import { server } from './server';
import { v4 } from 'uuid';

describe('Native HTTP server', () => {
    let createUserid: string = null
    afterAll(() => server.close());

    test('GET /api/users should return list of users', async () => {
        const res = await request(server).get('/api/users');
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual([]);
    });

    test('POST /api/users should create new user', async () => {
        const res = await request(server).post('/api/users').send({
            username: 'Alex',
            age: 18,
            hobbies: ['football']
        });
        expect(res.statusCode).toBe(201);
        const newUser = {
            id: expect.any(String),
            username: 'Alex',
            age: 18,
            hobbies: ['football'],
        }
        expect(res.body).toEqual(newUser)
        const listResponse = await request(server).get('/api/users');
        createUserid = res.body.id
        expect(listResponse.body).toEqual([newUser]);
    })

    test(`GET /api/users/#{id} should return user`, async () => {
        const res = await request(server).get(`/api/users/${createUserid}`);
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({
            id: createUserid,
            username: 'Alex',
            age: 18,
            hobbies: ['football'],
        })
    })

    test('GET /api/users/1234 should return 400', async () => {
        const res = await request(server).get(`/api/users/321312`);
        expect(res.statusCode).toBe(400);
        expect(res.body).toEqual({ message: 'Invalid user id (must be UUID v4)' })
    })

    test('GET /api/users/not_existing_id should return 404', async () => {
        const res = await request(server).get(`/api/users/${v4()}`);
        expect(res.statusCode).toBe(404);
        expect(res.body).toEqual({ message: 'User not found' })
    })

    test('PUT /api/users/id should return updated user', async () => {
        const res = await request(server).put(`/api/users/${createUserid}`).send({
            age: 123,
            username: 'Alexa',
            hobbies: ['football', 'basketball']
        });
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ id: createUserid, age: 123, hobbies: ['football', 'basketball'], username: 'Alexa' })
    })

    test('DELETE /api/users/id should return 204', async () => {
        const res = await request(server).delete(`/api/users/${createUserid}`);
        expect(res.statusCode).toBe(204);
    })

    test('GET /api/users/id should return 404 after user removal', async () => {
        const res = await request(server).get(`/api/users/${createUserid}`);
        expect(res.statusCode).toBe(404);
    })
});
