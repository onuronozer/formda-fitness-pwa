const RELOAD_MARKER_KEY = 'formda:stale-bundle-reload'

const staleBundlePatterns = [
  /failed to fetch dynamically imported module/i,
  /importing a module script failed/i,
  /error loading dynamically imported module/i,
  /loading (?:css )?chunk .+ failed/i,
  /chunkloaderror/i,
]

function errorMessage(cause: unknown) {
  if (cause instanceof Error) return `${cause.name}: ${cause.message}`
  return typeof cause === 'string' ? cause : ''
}

export function isStaleBundleError(cause: unknown) {
  const message = errorMessage(cause)
  return message.length > 0 && staleBundlePatterns.some((pattern) => pattern.test(message))
}

function currentBundleToken() {
  const entry = [...document.querySelectorAll<HTMLScriptElement>('script[type="module"][src]')]
    .map((script) => script.src)
    .find((source) => source.includes('/assets/index-'))
  return entry ?? __APP_VERSION__
}

export function recoverFromStaleBundle(
  cause: unknown,
  options: { storage?: Pick<Storage, 'getItem' | 'setItem'>; reload?: () => void; bundleToken?: string } = {},
) {
  if (!isStaleBundleError(cause)) return false

  const storage = options.storage ?? window.sessionStorage
  const fingerprint = `${options.bundleToken ?? currentBundleToken()}::${errorMessage(cause)}`
  if (storage.getItem(RELOAD_MARKER_KEY) === fingerprint) return false

  storage.setItem(RELOAD_MARKER_KEY, fingerprint)
  ;(options.reload ?? (() => window.location.reload()))()
  return true
}

export function clearStaleBundleRecovery(storage: Pick<Storage, 'removeItem'> = window.sessionStorage) {
  storage.removeItem(RELOAD_MARKER_KEY)
}
