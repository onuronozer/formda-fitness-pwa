import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const rules = readFileSync(resolve('firestore.rules'), 'utf8')
const adapter = readFileSync(resolve('src/sync/FirebaseAdapter.ts'), 'utf8')

describe('Firestore security contract', () => {
  it('requires authentication and matching path UID', () => { expect(rules).toContain('request.auth != null'); expect(rules).toContain('request.auth.uid == userId') })
  it('rejects unauthenticated access by default', () => expect(rules).toContain('allow read, write: if false'))
  it('validates owner UID on existing and incoming records', () => { expect(rules).toContain('resource.data.userId == userId'); expect(rules).toContain('data.userId == userId') })
  it('does not embed privileged server credentials in the frontend adapter', () => { expect(adapter).not.toMatch(/serviceAccount|private_key|adminCredential|BEGIN PRIVATE KEY/i) })
})
