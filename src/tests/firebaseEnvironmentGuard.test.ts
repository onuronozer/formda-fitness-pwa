import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const script = resolve('scripts/validate-firebase-environment.mjs')
const production = {
  FIREBASE_DEPLOY_MODE: 'enabled',
  VITE_FIREBASE_ENVIRONMENT: 'production',
  VITE_FIREBASE_API_KEY: 'public-api-key',
  VITE_FIREBASE_AUTH_DOMAIN: 'formda.example.test',
  VITE_FIREBASE_PROJECT_ID: 'formda-production',
  VITE_FIREBASE_STORAGE_BUCKET: 'formda-production.example.test',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '123456789',
  VITE_FIREBASE_APP_ID: '1:123456789:web:test',
  VITE_FIREBASE_EXPECTED_PROJECT_ID: 'formda-production',
  VITE_FIREBASE_USE_EMULATOR: 'false',
}

function validate(changes: Record<string, string | undefined>) {
  const env: NodeJS.ProcessEnv = { ...process.env, ...production, ...changes }
  for (const [key, value] of Object.entries(env)) if (value === undefined) delete env[key]
  return spawnSync(process.execPath, [script], { env, encoding: 'utf8' })
}

describe('Firebase production environment guard', () => {
  it('accepts an explicit not-configured App Check state', () => {
    const result = validate({ VITE_FIREBASE_APPCHECK_STATUS: 'not_configured', VITE_FIREBASE_APPCHECK_SITE_KEY: undefined })
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('App Check=not_configured')
  })

  it('rejects monitoring without a real App Check site key', () => {
    const result = validate({ VITE_FIREBASE_APPCHECK_STATUS: 'monitoring', VITE_FIREBASE_APPCHECK_SITE_KEY: undefined })
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('requires VITE_FIREBASE_APPCHECK_SITE_KEY')
  })

  it('accepts monitoring when a site key is supplied', () => {
    const result = validate({ VITE_FIREBASE_APPCHECK_STATUS: 'monitoring', VITE_FIREBASE_APPCHECK_SITE_KEY: 'test-site-key' })
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('App Check=monitoring')
  })

  it('rejects an unknown App Check status', () => {
    const result = validate({ VITE_FIREBASE_APPCHECK_STATUS: 'pretend-enforced', VITE_FIREBASE_APPCHECK_SITE_KEY: 'test-site-key' })
    expect(result.status).not.toBe(0)
  })
})
