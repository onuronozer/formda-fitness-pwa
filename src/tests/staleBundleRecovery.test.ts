import { describe, expect, it, vi } from 'vitest'
import { isStaleBundleError, recoverFromStaleBundle } from '../utils/staleBundleRecovery'

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
  }
}

describe('stale bundle recovery', () => {
  it('recognizes failed lazy route imports', () => {
    expect(isStaleBundleError(new TypeError('Failed to fetch dynamically imported module: /assets/ExercisePage-old.js'))).toBe(true)
    expect(isStaleBundleError(new Error('ordinary render failure'))).toBe(false)
  })

  it('reloads once for the same failed bundle and route chunk', () => {
    const storage = memoryStorage()
    const reload = vi.fn()
    const error = new TypeError('Failed to fetch dynamically imported module: /assets/ExercisePage-old.js')

    expect(recoverFromStaleBundle(error, { storage, reload, bundleToken: 'index-old.js' })).toBe(true)
    expect(recoverFromStaleBundle(error, { storage, reload, bundleToken: 'index-old.js' })).toBe(false)
    expect(reload).toHaveBeenCalledTimes(1)
  })
})
