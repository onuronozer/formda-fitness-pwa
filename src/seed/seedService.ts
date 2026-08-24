import { createEntityMetadata } from '../domain/models'
import { appDb, type FormdaDatabase } from '../db/database'
import { HEALTH_RULES_VERSION } from '../rules/health'
import { EXERCISE_SEED_VERSION } from '../config/workouts'
import { clinicalEvidenceSeed, CLINICAL_EVIDENCE_SEED_VERSION } from './evidenceSeed'
import { intervalProtocolSeed } from './intervalSeed'
import { INTERVAL_RULE_VERSION } from '../config/phase3b'

export async function ensureSeedVersions(database: FormdaDatabase = appDb) {
  const existing = await database.seedVersions.where('dataset').equals('health_rules').first()
  if (!existing || existing.dataVersion < HEALTH_RULES_VERSION) {
    const now = new Date().toISOString()
    await database.seedVersions.put({
      ...(existing ? { ...existing, updatedAt: now, version: existing.version + 1 } : createEntityMetadata(now)),
      dataset: 'health_rules',
      dataVersion: HEALTH_RULES_VERSION,
      appliedAt: now,
    })
  }
  const evidenceVersion = await database.seedVersions.where('dataset').equals('evidence').first()
  if (!evidenceVersion || evidenceVersion.dataVersion < CLINICAL_EVIDENCE_SEED_VERSION || await database.evidenceReferences.where('id').anyOf(clinicalEvidenceSeed.map((item) => item.id)).count() < clinicalEvidenceSeed.length) {
    const now = new Date().toISOString()
    await database.transaction('rw', [database.evidenceReferences, database.seedVersions], async () => {
      await database.evidenceReferences.bulkPut(clinicalEvidenceSeed)
      await database.seedVersions.put({
        ...(evidenceVersion ? { ...evidenceVersion, updatedAt: now, version: evidenceVersion.version + 1 } : createEntityMetadata(now)),
        dataset: 'evidence', dataVersion: CLINICAL_EVIDENCE_SEED_VERSION, appliedAt: now,
      })
    })
  }
  const intervalVersion = await database.seedVersions.where('dataset').equals('interval_protocols').first()
  if (!intervalVersion || intervalVersion.dataVersion < INTERVAL_RULE_VERSION || await database.intervalProtocols.count() < intervalProtocolSeed.length) {
    const now = new Date().toISOString()
    await database.transaction('rw', [database.intervalProtocols, database.seedVersions], async () => {
      await database.intervalProtocols.bulkPut(intervalProtocolSeed)
      await database.seedVersions.put({
        ...(intervalVersion ? { ...intervalVersion, updatedAt: now, version: intervalVersion.version + 1 } : createEntityMetadata(now)),
        dataset: 'interval_protocols', dataVersion: INTERVAL_RULE_VERSION, appliedAt: now,
      })
    })
  }
}

export async function ensureExerciseSeed(database: FormdaDatabase = appDb) {
  const existing = await database.seedVersions.where('dataset').equals('exercises').first()
  if (existing && existing.dataVersion >= EXERCISE_SEED_VERSION && await database.exercises.count() > 0) return

  const seed = await import('./exerciseSeed')
  const now = new Date().toISOString()
  await database.transaction('rw', [database.muscles, database.equipment, database.exercises, database.exerciseHealthConsiderations, database.exerciseMedia, database.evidenceReferences, database.seedVersions], async () => {
    await Promise.all([
      database.muscles.clear(), database.equipment.clear(), database.exercises.clear(), database.exerciseHealthConsiderations.clear(), database.exerciseMedia.clear(),
    ])
    await database.muscles.bulkPut(seed.muscleSeed)
    await database.equipment.bulkPut(seed.equipmentSeed)
    await database.exercises.bulkPut(seed.exerciseSeed)
    await database.exerciseHealthConsiderations.bulkPut(seed.exerciseHealthConsiderationSeed)
    await database.exerciseMedia.bulkPut(seed.exerciseMediaSeed)
    await database.evidenceReferences.bulkPut(seed.exerciseEvidenceSeed)
    await database.seedVersions.put({
      ...(existing ? { ...existing, updatedAt: now, version: existing.version + 1 } : createEntityMetadata(now)),
      dataset: 'exercises',
      dataVersion: EXERCISE_SEED_VERSION,
      appliedAt: now,
    })
  })
}
