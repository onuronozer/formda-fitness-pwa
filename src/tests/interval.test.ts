import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { createEntityMetadata, type IntervalProtocol } from '../domain/models'
import { FormdaDatabase } from '../db/database'
import { getIntervalTimerState, intervalTotalSeconds, IntervalService } from '../services/IntervalService'
import { USER_ID } from './fixtures'

const protocol: IntervalProtocol = { ...createEntityMetadata('2026-08-24T08:00:00.000Z'), id: 'interval-walking-beginner-1', name: 'Yürüyüş Interval 1', modality: 'walking', difficulty: 'beginner', warmupSeconds: 300, workSeconds: 60, recoverySeconds: 120, rounds: 6, cooldownSeconds: 300, intensityLabel: 'Tempolu / rahat', allowedWhenModified: false, active: true, ruleVersion: 1 }
const names: string[] = []
const create = async () => { const name = `formda-interval-${crypto.randomUUID()}`; names.push(name); const db = new FormdaDatabase(name); await db.intervalProtocols.add(protocol); return { db, service: new IntervalService(db) } }
afterEach(async () => { await Promise.all(names.splice(0).map((name) => Dexie.delete(name))) })

describe('interval training', () => {
  it('loads a protocol and calculates 28 minutes', async () => { const { db, service } = await create(); expect(await service.getProtocol(protocol.id)).toMatchObject({ modality: 'walking', rounds: 6 }); expect(intervalTotalSeconds(protocol)).toBe(1_680); db.close() })
  it.each([[0, 'warmup'], [300, 'work'], [360, 'recovery'], [1_380, 'cooldown'], [1_680, 'complete']] as const)('maps second %i to %s', (second, phase) => expect(getIntervalTimerState(protocol, second).phase).toBe(phase))
  it('advances rounds deterministically', () => { expect(getIntervalTimerState(protocol, 480).round).toBe(2); expect(getIntervalTimerState(protocol, 1_379).round).toBe(6) })
  it('logs completion and feedback offline', async () => {
    const { db, service } = await create(); const session = await service.start(USER_ID, protocol.id, 'NORMAL', '2026-08-24T09:00:00.000Z')
    const completed = await service.finish(session.id, 'completed', 6, undefined, '2026-08-24T09:28:00.000Z')
    const rated = await service.updateFeedback(completed.id, 3)
    expect(rated).toMatchObject({ status: 'completed', roundsCompleted: 6, perceivedDifficulty: 3 }); expect(await db.syncOutbox.count()).toBe(3); db.close()
  })
  it('logs an early stop', async () => { const { db, service } = await create(); const session = await service.start(USER_ID, protocol.id, 'NORMAL'); expect(await service.finish(session.id, 'stopped_early', 2)).toMatchObject({ status: 'stopped_early', roundsCompleted: 2 }); db.close() })
  it.each(['MODIFIED', 'MEDICAL_REVIEW_REQUIRED', 'RED_FLAG_BLOCKED'] as const)('blocks %s health status', async (status) => { const { db, service } = await create(); await expect(service.start(USER_ID, protocol.id, status)).rejects.toThrow('HEALTH_BLOCKED'); expect(await db.cardioSessions.count()).toBe(0); db.close() })
  it('persists a session in IndexedDB without cloud', async () => { const { db, service } = await create(); await service.start(USER_ID, protocol.id, 'NORMAL'); expect(await db.cardioSessions.count()).toBe(1); db.close() })
})
