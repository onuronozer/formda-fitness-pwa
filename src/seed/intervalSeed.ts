import { INTERVAL_RULE_VERSION, WALKING_BEGINNER_PROTOCOL_ID } from '../config/phase3b'
import type { IntervalProtocol } from '../domain/models'

const reviewedAt = '2026-08-24T00:00:00.000Z'

export const intervalProtocolSeed: IntervalProtocol[] = [{
  id: WALKING_BEGINNER_PROTOCOL_ID,
  name: 'Yürüyüş Interval 1',
  modality: 'walking',
  difficulty: 'beginner',
  warmupSeconds: 300,
  workSeconds: 60,
  recoverySeconds: 120,
  rounds: 6,
  cooldownSeconds: 300,
  intensityLabel: 'Tempolu / rahat',
  allowedWhenModified: false,
  active: true,
  ruleVersion: INTERVAL_RULE_VERSION,
  createdAt: reviewedAt,
  updatedAt: reviewedAt,
  version: 1,
  schemaVersion: 5,
}]
