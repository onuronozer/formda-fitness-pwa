import { firebaseEnvironment } from '../config/firebaseEnvironment'

export const firebaseConfig = firebaseEnvironment.config
export const isFirebaseConfigured = firebaseEnvironment.configured
export const useFirebaseEmulator = firebaseEnvironment.useEmulator
