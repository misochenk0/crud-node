import { v4 } from 'uuid'
import { User, UserInput } from '../types/index'

const users = new Map<string, User>()

export function listUsers(): User[] {
  return Array.from(users.values())
}

export function getUser(id: string): User | undefined {
  return users.get(id)
}

export function createUser(input: UserInput) {
  const user: User = { id: v4(), ...input }
  users.set(user.id, user)
  return user
}

export function updateUser(id: string, input: UserInput): User | undefined {
  if (!users.has(id)) return undefined
  const updated: User = { id, ...input }
  users.set(id, updated)
  return updated
}

export function deleteUser(id: string): boolean {
  return users.delete(id)
}
