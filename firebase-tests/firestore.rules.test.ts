import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterAll, afterEach, beforeAll, describe, it } from 'vitest'
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore'

const PROJECT_ID = 'demo-formda-fitness'
const LOCAL_USER_ID = '11111111-1111-4111-8111-111111111111'
let environment: RulesTestEnvironment

const record = (userId: string, overrides: Record<string, unknown> = {}) => ({
  id: 'userProfiles__profile-a', userId, localUserId: LOCAL_USER_ID, entityType: 'userProfiles', entityId: 'profile-a', operation: 'upsert',
  payload: { id: LOCAL_USER_ID, version: 1 }, entityVersion: 1, entityUpdatedAt: '2026-08-24T08:00:00.000Z', clientId: 'client-a', syncedAt: '2026-08-24T08:01:00.000Z',
  ...overrides,
})

const path = (database: ReturnType<RulesTestEnvironment['authenticatedContext']>['firestore'], userId: string, id = 'userProfiles__profile-a') => doc(database(), 'users', userId, 'records', id)
const context = (uid: string, verified = true) => environment.authenticatedContext(uid, { email: `${uid}@example.test`, email_verified: verified })

beforeAll(async () => {
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':')
  environment = await initializeTestEnvironment({ projectId: PROJECT_ID, firestore: { host, port: Number(port), rules: readFileSync(resolve('firestore.rules'), 'utf8') } })
})
afterEach(async () => environment.clearFirestore())
afterAll(async () => environment?.cleanup())

async function seed(userId: string, value = record(userId)) {
  await environment.withSecurityRulesDisabled(async (admin) => setDoc(path(() => admin.firestore(), userId), value))
}

describe('Firestore owner rules emulator matrix', () => {
  it('denies unauthenticated read, create, update and delete', async () => {
    await seed('user-a')
    const database = () => environment.unauthenticatedContext().firestore()
    await assertFails(getDoc(path(database, 'user-a')))
    await assertFails(setDoc(path(database, 'user-a', 'userProfiles__new'), record('user-a', { id: 'userProfiles__new', entityId: 'new' })))
    await assertFails(updateDoc(path(database, 'user-a'), { entityVersion: 2 }))
    await assertFails(deleteDoc(path(database, 'user-a')))
  })

  it('allows a verified user to read, create, update and delete own records', async () => {
    const database = () => context('user-a').firestore()
    const target = path(database, 'user-a')
    await assertSucceeds(setDoc(target, record('user-a')))
    await assertSucceeds(getDoc(target))
    await assertSucceeds(getDocs(query(collection(database(), 'users', 'user-a', 'records'), where('userId', '==', 'user-a'))))
    await assertSucceeds(updateDoc(target, { payload: { id: LOCAL_USER_ID, version: 2 }, entityVersion: 2 }))
    await assertSucceeds(deleteDoc(target))
  })

  it('denies User A read, create, update and delete against User B', async () => {
    await seed('user-b')
    const database = () => context('user-a').firestore()
    await assertFails(getDoc(path(database, 'user-b')))
    await assertFails(getDocs(query(collection(database(), 'users', 'user-b', 'records'), where('userId', '==', 'user-b'))))
    await assertFails(setDoc(path(database, 'user-b', 'userProfiles__new'), record('user-b', { id: 'userProfiles__new', entityId: 'new' })))
    await assertFails(updateDoc(path(database, 'user-b'), { entityVersion: 2 }))
    await assertFails(deleteDoc(path(database, 'user-b')))
  })

  it('denies forged envelope owner and unverified writes', async () => {
    await assertFails(setDoc(path(() => context('user-a').firestore(), 'user-a'), record('user-b')))
    await assertFails(setDoc(path(() => context('user-a', false).firestore(), 'user-a'), record('user-a')))
  })

  it('denies entity type, entity id and local owner mutation', async () => {
    await seed('user-a')
    const target = path(() => context('user-a').firestore(), 'user-a')
    await assertFails(updateDoc(target, { entityType: 'waterRecords' }))
    await assertFails(updateDoc(target, { entityId: 'other' }))
    await assertFails(updateDoc(target, { localUserId: '22222222-2222-4222-8222-222222222222' }))
  })
})
