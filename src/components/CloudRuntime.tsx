import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'
import { appDb } from '../db/database'
import { UserRepository } from '../db/repositories'
import { ShortcutActionHandler } from './ShortcutActionHandler'

const userRepository = new UserRepository()

export function CloudRuntime() {
  const profile = useLiveQuery(() => userRepository.getActive())
  const preference = useLiveQuery(() => profile ? appDb.cloudSyncPreferences.where('userId').equals(profile.id).first() : undefined, [profile?.id])
  useEffect(() => {
    if (!profile || !preference?.enabled) return
    let stop: (() => void) | undefined
    let cancelled = false
    void import('../sync/SyncCoordinator').then(({ SyncCoordinator }) => {
      if (!cancelled) stop = new SyncCoordinator().start(profile.id)
    })
    return () => { cancelled = true; stop?.() }
  }, [preference?.enabled, profile])
  return profile ? <ShortcutActionHandler userId={profile.id} /> : null
}
