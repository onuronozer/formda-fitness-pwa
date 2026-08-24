import { z } from 'zod'

const environmentSchema = z.object({
  environment: z.enum(['development', 'production']),
  apiKey: z.string().min(1),
  authDomain: z.string().min(1),
  projectId: z.string().min(1),
  storageBucket: z.string().min(1),
  messagingSenderId: z.string().min(1),
  appId: z.string().min(1),
  expectedProjectId: z.string().min(1).optional(),
  appCheckSiteKey: z.string().min(1).optional(),
})

const requestedEnvironment = import.meta.env.VITE_FIREBASE_ENVIRONMENT
const parsed = environmentSchema.safeParse({
  environment: requestedEnvironment,
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  expectedProjectId: import.meta.env.VITE_FIREBASE_EXPECTED_PROJECT_ID || undefined,
  appCheckSiteKey: import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY || undefined,
})

const projectMatches = parsed.success && (!parsed.data.expectedProjectId || parsed.data.expectedProjectId === parsed.data.projectId)

export const firebaseEnvironment = {
  configured: parsed.success && projectMatches,
  environment: parsed.success ? parsed.data.environment : 'disabled' as const,
  config: parsed.success && projectMatches ? {
    apiKey: parsed.data.apiKey,
    authDomain: parsed.data.authDomain,
    projectId: parsed.data.projectId,
    storageBucket: parsed.data.storageBucket,
    messagingSenderId: parsed.data.messagingSenderId,
    appId: parsed.data.appId,
  } : undefined,
  appCheckSiteKey: parsed.success ? parsed.data.appCheckSiteKey : undefined,
  useEmulator: import.meta.env.VITE_FIREBASE_USE_EMULATOR === 'true',
  authEmulatorUrl: import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL || 'http://127.0.0.1:9099',
  firestoreEmulatorHost: import.meta.env.VITE_FIREBASE_FIRESTORE_EMULATOR_HOST || '127.0.0.1',
  firestoreEmulatorPort: Number(import.meta.env.VITE_FIREBASE_FIRESTORE_EMULATOR_PORT || 8080),
  issue: requestedEnvironment === undefined || requestedEnvironment === 'disabled'
    ? 'CLOUD_EXPLICITLY_DISABLED'
    : !parsed.success ? 'FIREBASE_CONFIG_INVALID' : !projectMatches ? 'FIREBASE_PROJECT_MISMATCH' : undefined,
} as const

export type FirebaseEnvironment = typeof firebaseEnvironment
