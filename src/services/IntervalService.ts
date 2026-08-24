import { appDb, type FormdaDatabase } from '../db/database'
import type { HealthGateStatus } from '../domain/enums'
import { createEntityMetadata, type CardioSession, type IntervalProtocol } from '../domain/models'
import { SyncQueue } from '../sync/SyncQueue'
import { toLocalDate } from '../utils/localDate'
import { cardioSessionSchema } from '../validation/phase3bSchemas'

export type IntervalTimerPhase = 'warmup' | 'work' | 'recovery' | 'cooldown' | 'complete'
export interface IntervalTimerState { phase: IntervalTimerPhase; round: number; rounds: number; phaseElapsed: number; phaseRemaining: number; totalElapsed: number; totalSeconds: number }

export function intervalTotalSeconds(protocol: IntervalProtocol) {
  return protocol.warmupSeconds + protocol.rounds * (protocol.workSeconds + protocol.recoverySeconds) + protocol.cooldownSeconds
}

export function getIntervalTimerState(protocol: IntervalProtocol, elapsedSeconds: number): IntervalTimerState {
  const totalSeconds = intervalTotalSeconds(protocol)
  const elapsed = Math.max(0, Math.min(Math.floor(elapsedSeconds), totalSeconds))
  if (elapsed >= totalSeconds) return { phase: 'complete', round: protocol.rounds, rounds: protocol.rounds, phaseElapsed: 0, phaseRemaining: 0, totalElapsed: elapsed, totalSeconds }
  if (elapsed < protocol.warmupSeconds) return { phase: 'warmup', round: 0, rounds: protocol.rounds, phaseElapsed: elapsed, phaseRemaining: protocol.warmupSeconds - elapsed, totalElapsed: elapsed, totalSeconds }
  const intervalElapsed = elapsed - protocol.warmupSeconds
  const intervalBlock = protocol.workSeconds + protocol.recoverySeconds
  const roundIndex = Math.floor(intervalElapsed / intervalBlock)
  if (roundIndex < protocol.rounds) {
    const withinRound = intervalElapsed % intervalBlock
    if (withinRound < protocol.workSeconds) return { phase: 'work', round: roundIndex + 1, rounds: protocol.rounds, phaseElapsed: withinRound, phaseRemaining: protocol.workSeconds - withinRound, totalElapsed: elapsed, totalSeconds }
    const recoveryElapsed = withinRound - protocol.workSeconds
    return { phase: 'recovery', round: roundIndex + 1, rounds: protocol.rounds, phaseElapsed: recoveryElapsed, phaseRemaining: protocol.recoverySeconds - recoveryElapsed, totalElapsed: elapsed, totalSeconds }
  }
  const cooldownElapsed = intervalElapsed - protocol.rounds * intervalBlock
  return { phase: 'cooldown', round: protocol.rounds, rounds: protocol.rounds, phaseElapsed: cooldownElapsed, phaseRemaining: protocol.cooldownSeconds - cooldownElapsed, totalElapsed: elapsed, totalSeconds }
}

export class IntervalService {
  private readonly queue: SyncQueue
  constructor(private readonly db: FormdaDatabase = appDb) { this.queue = new SyncQueue(db) }
  async getProtocol(id: string) { return this.db.intervalProtocols.get(id) }
  async listActive() { return this.db.intervalProtocols.where('active').equals(1).toArray() }

  async start(userId: string, protocolId: string, healthStatus: HealthGateStatus, startedAt = new Date().toISOString()) {
    const protocol = await this.db.intervalProtocols.get(protocolId)
    if (!protocol?.active) throw new Error('Interval protokolü bulunamadı.')
    if (healthStatus === 'MEDICAL_REVIEW_REQUIRED' || healthStatus === 'RED_FLAG_BLOCKED' || (healthStatus === 'MODIFIED' && !protocol.allowedWhenModified)) throw new Error('HEALTH_BLOCKED')
    const session = cardioSessionSchema.parse({ ...createEntityMetadata(startedAt), userId, protocolId, localDate: toLocalDate(startedAt), startedAt, roundsCompleted: 0, status: 'in_progress' })
    await this.db.transaction('rw', [this.db.cardioSessions, this.db.syncOutbox], async () => {
      await this.db.cardioSessions.add(session)
      await this.queue.enqueue(userId, 'cardioSessions', session as CardioSession & Record<string, unknown>)
    })
    return session
  }

  async finish(id: string, status: 'completed' | 'stopped_early', roundsCompleted: number, feedback?: { perceivedDifficulty?: number; feedback?: string }, completedAt = new Date().toISOString()) {
    const current = await this.db.cardioSessions.get(id)
    if (!current) throw new Error('Cardio oturumu bulunamadı.')
    const session = cardioSessionSchema.parse({ ...current, status, roundsCompleted, ...feedback, completedAt, updatedAt: completedAt, version: current.version + 1 })
    await this.db.transaction('rw', [this.db.cardioSessions, this.db.syncOutbox], async () => {
      await this.db.cardioSessions.put(session)
      await this.queue.enqueue(session.userId, 'cardioSessions', session as CardioSession & Record<string, unknown>)
    })
    return session
  }

  async updateFeedback(id: string, perceivedDifficulty: number) {
    const current = await this.db.cardioSessions.get(id)
    if (!current || current.status === 'in_progress') throw new Error('Cardio oturumu tamamlanmamış.')
    return this.finish(id, current.status, current.roundsCompleted, { perceivedDifficulty }, current.completedAt)
  }
}
