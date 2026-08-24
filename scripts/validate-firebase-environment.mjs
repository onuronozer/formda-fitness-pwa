const mode = process.env.FIREBASE_DEPLOY_MODE

if (mode === 'disabled') {
  if (process.env.VITE_FIREBASE_ENVIRONMENT && process.env.VITE_FIREBASE_ENVIRONMENT !== 'disabled') throw new Error('Cloud-disabled build cannot declare a Firebase environment.')
  process.stdout.write('Firebase production guard: cloud explicitly disabled.\n')
  process.exit(0)
}

if (mode !== 'enabled') throw new Error('FIREBASE_DEPLOY_MODE must be explicitly set to enabled or disabled.')
if (process.env.VITE_FIREBASE_ENVIRONMENT !== 'production') throw new Error('Cloud-enabled deploy requires VITE_FIREBASE_ENVIRONMENT=production.')
if (process.env.VITE_FIREBASE_USE_EMULATOR === 'true') throw new Error('Production deploy cannot use Firebase emulators.')

const required = [
  'VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID', 'VITE_FIREBASE_APP_ID', 'VITE_FIREBASE_EXPECTED_PROJECT_ID',
]
const missing = required.filter((name) => !process.env[name]?.trim())
if (missing.length) throw new Error(`Missing production Firebase variables: ${missing.join(', ')}`)
if (process.env.VITE_FIREBASE_PROJECT_ID !== process.env.VITE_FIREBASE_EXPECTED_PROJECT_ID) throw new Error('Firebase project ID does not match the production guard value.')

const appCheckStatus = process.env.VITE_FIREBASE_APPCHECK_STATUS || 'not_configured'
if (!['not_configured', 'monitoring', 'enforced'].includes(appCheckStatus)) throw new Error('VITE_FIREBASE_APPCHECK_STATUS must be not_configured, monitoring or enforced.')
if (appCheckStatus !== 'not_configured' && !process.env.VITE_FIREBASE_APPCHECK_SITE_KEY?.trim()) {
  throw new Error(`App Check ${appCheckStatus} rollout requires VITE_FIREBASE_APPCHECK_SITE_KEY.`)
}

process.stdout.write(`Firebase production guard: validated production configuration; App Check=${appCheckStatus}.\n`)
