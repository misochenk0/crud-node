import { validate, version } from 'uuid'

export function isUuidV4(id: string): boolean {
  return validate(id) && version(id) === 4
}

export function validateUserBody(body: unknown): { ok: true; value: { username: string; age: number; hobbies: string[] } } | { ok: false; message: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, message: 'Body must be an object' }
  }
  const { username, age, hobbies } = body as Record<string, unknown>

  if (typeof username !== 'string' || username.trim() === '') {
    return { ok: false, message: 'username must be a non-empty string' }
  }
  if (typeof age !== 'number' || !Number.isFinite(age) || age < 0) {
    return { ok: false, message: 'age must be a non-negative number' }
  }
  if (!Array.isArray(hobbies) || !hobbies.every((h) => typeof h === 'string')) {
    return { ok: false, message: 'hobbies must be an array of strings' }
  }
  return { ok: true, value: { username, age, hobbies } }
}
