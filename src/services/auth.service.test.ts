import { beforeEach, describe, expect, it } from 'vitest'
import { KEYS, migrateLegacyDemoNames, repairDemoData, resetDB } from './db'
import { getCurrentUser, login, logout, register } from './auth.service'
import { getCachedApiUser, setApiToken, setCachedApiUser } from '@/lib/api'
import { read, write } from '@/lib/storage'
import { DEMO_PASSWORD } from '@/data/demo'
import type { User } from '@/types'

beforeEach(() => {
  localStorage.clear()
  resetDB()
})

describe('auth.service', () => {
  it('logs in a seeded user and hides the password', async () => {
    const user = await login('mostafa@tawasol.com', DEMO_PASSWORD)
    expect(user.email).toBe('mostafa@tawasol.com')
    expect('password' in user).toBe(false)
    expect(getCurrentUser()?.id).toBe(user.id)
  })

  it('rejects a wrong password', async () => {
    await expect(login('mostafa@tawasol.com', 'wrong')).rejects.toThrow()
  })

  it('signs in a demo account even when its stored hash is stale', async () => {
    const credentials = read<Array<{ userId: string; salt: string; hash: string }>>(KEYS.credentials, [])
    write(KEYS.credentials, credentials.map((credential) =>
      credential.userId === 'u1' ? { ...credential, hash: 'stale-demo-hash' } : credential))

    const user = await login('mostafa@tawasol.com', DEMO_PASSWORD)

    expect(user.email).toBe('mostafa@tawasol.com')
  })

  it('migrates the old demo name in stored user data', () => {
    const [user] = read<User[]>(KEYS.users, [])
    const [migrated] = migrateLegacyDemoNames([{ ...user, name: 'Mostafa Shehat' }])

    expect(migrated.name).toBe('Mustafa Shehata')
  })

  it('restores a missing demo account from partial localStorage data', async () => {
    write(KEYS.users, read<User[]>(KEYS.users, []).filter((user) => user.id !== 'u1'))
    write(KEYS.credentials, read<Array<{ userId: string }>>(KEYS.credentials, [])
      .filter((credential) => credential.userId !== 'u1'))

    repairDemoData()

    const user = await login('mostafa@tawasol.com', DEMO_PASSWORD)
    expect(user.email).toBe('mostafa@tawasol.com')
  })

  it('rejects a duplicate email on register', async () => {
    await expect(register({ name: 'Test User', email: 'MOSTAFA@tawasol.com', password: '123456', confirmPassword: '123456' })).rejects.toThrow()
  })

  it('registers a new user and starts a session', async () => {
    const user = await register({ name: 'Mustafa', email: 'mustafa@example.com', password: 'secret1', confirmPassword: 'secret1' })
    expect(getCurrentUser()?.id).toBe(user.id)
    logout()
    expect(getCurrentUser()).toBeNull()
  })

  it('clears the API profile cache and token on logout', () => {
    const user: User = {
      id: 'api-user-1',
      name: 'Mustafa',
      email: 'mustafa@example.com',
      avatar: 'data:image/jpeg;base64,photo',
      bio: 'Updated bio',
      location: 'Cairo',
      work: 'Developer',
      cover: 'from-teal-400 to-cyan-600',
      joinedAt: '2026-11-22T00:00:00.000Z',
    }
    setCachedApiUser(user)
    setApiToken('test-token')

    logout()

    expect(getCurrentUser()).toBeNull()
    expect(getCachedApiUser()).toBeNull()
    expect(localStorage.getItem('tawasol:api-token')).toBeNull()
    expect(localStorage.getItem('tawasol:api-user')).toBeNull()
  })

  it('validates password confirmation', async () => {
    await expect(register({ name: 'Mustafa', email: 'm@example.com', password: 'secret1', confirmPassword: 'secret2' })).rejects.toThrow()
  })
})
