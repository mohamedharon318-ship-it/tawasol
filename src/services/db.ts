import { clearAll, read, write } from '@/lib/storage'
import { clearApiSession } from '@/lib/api'
import { DEMO_PASSWORD } from '@/data/demo'
import { DEMO_SALT, hashPassword } from '@/lib/security'
import {
  defaultSettings, seedConversations, seedFriendRequests, seedNotifications, seedPosts, seedStories, seedUsers,
} from '@/data/seed'
import type {
  AppNotification, Conversation, Credential, FriendRequest, Post, Report,
  SearchEntry, Story, User, UserSettings,
} from '@/types'

export const KEYS = {
  users: 'users',
  credentials: 'credentials',
  passwordResets: 'password-resets',
  posts: 'posts',
  requests: 'friend-requests',
  conversations: 'conversations',
  notifications: 'notifications',
  stories: 'stories',
  hiddenPosts: 'hidden-posts',
  hiddenComments: 'hidden-comments',
  reactionOverrides: 'reaction-overrides',
  deletedPosts: 'deleted-posts',
  bookmarks: 'bookmarks',
  follows: 'follows',
  blocks: 'blocks',
  mutes: 'mutes',
  reports: 'reports',
  searchHistory: 'search-history',
  drafts: 'drafts',
  settings: 'settings',
  session: 'session',
} as const

const LEGACY_DEMO_NAMES: Record<string, string> = {
  'Mostafa Shehat': 'Mustafa Shehata',
  'Mostafa Shaehat': 'Mustafa Shehata',
}

export function migrateLegacyDemoNames(users: User[]): User[] {
  return users.map((user) => {
    const nextName = LEGACY_DEMO_NAMES[user.name]
    return nextName ? { ...user, name: nextName } : user
  })
}

export function repairDemoData(): void {
  const storedUsers = read<User[]>(KEYS.users, [])
  const renamedUsers = migrateLegacyDemoNames(storedUsers)
  const userIds = new Set(renamedUsers.map((user) => user.id))
  const users = [...renamedUsers, ...seedUsers.filter((user) => !userIds.has(user.id))]
  if (users.length !== storedUsers.length || users.some((user, index) => user !== storedUsers[index])) {
    write(KEYS.users, users)
  }

  const storedCredentials = read<Credential[]>(KEYS.credentials, [])
  const credentialUserIds = new Set(storedCredentials.map((credential) => credential.userId))
  const credentials = [
    ...storedCredentials,
    ...seedUsers
      .filter((user) => !credentialUserIds.has(user.id))
      .map((user) => ({ userId: user.id, salt: DEMO_SALT, hash: hashPassword(DEMO_PASSWORD) })),
  ]
  if (credentials.length !== storedCredentials.length) write(KEYS.credentials, credentials)
}

let initialized = false

export function ensureDB(): void {
  if (initialized) return
  if (read<User[] | null>(KEYS.users, null) === null) write(KEYS.users, seedUsers)
  if (read<Credential[] | null>(KEYS.credentials, null) === null) {
    write(KEYS.credentials, seedUsers.map((user) => ({
      userId: user.id,
      salt: DEMO_SALT,
      hash: hashPassword(DEMO_PASSWORD),
    })))
  }
  if (read<unknown[] | null>(KEYS.passwordResets, null) === null) write(KEYS.passwordResets, [])
  if (read<Post[] | null>(KEYS.posts, null) === null) write(KEYS.posts, seedPosts)
  if (read<FriendRequest[] | null>(KEYS.requests, null) === null) write(KEYS.requests, seedFriendRequests)
  if (read<Conversation[] | null>(KEYS.conversations, null) === null) write(KEYS.conversations, seedConversations)
  if (read<AppNotification[] | null>(KEYS.notifications, null) === null) write(KEYS.notifications, seedNotifications)
  if (read<Story[] | null>(KEYS.stories, null) === null) write(KEYS.stories, seedStories)
  if (read<Report[] | null>(KEYS.reports, null) === null) write(KEYS.reports, [])
  if (read<SearchEntry[] | null>(KEYS.searchHistory, null) === null) write(KEYS.searchHistory, [])

  repairDemoData()

  const users = read<User[]>(KEYS.users, [])
  const settings = read<Record<string, UserSettings>>(KEYS.settings, {})
  users.forEach((user) => {
    if (!settings[user.id]) settings[user.id] = defaultSettings(user.id)
  })
  write(KEYS.settings, settings)
  initialized = true
}

export function resetDB(): void {
  clearApiSession()
  clearAll()
  initialized = false
  ensureDB()
}
