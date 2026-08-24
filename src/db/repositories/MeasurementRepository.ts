import Dexie from 'dexie'
import { compareMeasurementRecency } from '../../domain/measurements/analytics'
import type { StepRecord, WaistRecord, WeightRecord } from '../../domain/models'
import { stepRecordSchema, waistRecordSchema, weightRecordSchema } from '../../validation/measurementSchemas'
import { appDb, type FormdaDatabase } from '../database'
import { SyncQueue } from '../../sync/SyncQueue'

type WeightChanges = Pick<WeightRecord, 'valueKg' | 'measuredAt' | 'localDate' | 'note'>
type WaistChanges = Pick<WaistRecord, 'valueCm' | 'measuredAt' | 'localDate' | 'note'>
type StepChanges = Pick<StepRecord, 'stepCount' | 'measuredAt' | 'localDate'>

export class MeasurementRepository {
  private readonly queue: SyncQueue
  constructor(private readonly db: FormdaDatabase = appDb) { this.queue = new SyncQueue(db) }

  async insertWeight(record: WeightRecord): Promise<WeightRecord> {
    const valid = weightRecordSchema.parse(record)
    await this.db.transaction('rw', [this.db.weightRecords, this.db.syncOutbox], async () => { await this.db.weightRecords.add(valid); await this.queue.enqueue(valid.userId, 'weightRecords', valid as WeightRecord & Record<string, unknown>) })
    await this.syncProfileWeight(valid.userId)
    return valid
  }

  async updateWeight(id: string, changes: WeightChanges): Promise<WeightRecord> {
    const current = await this.requireActive<WeightRecord>(this.db.weightRecords, id, 'Kilo kaydı bulunamadı.')
    const updated = weightRecordSchema.parse({ ...current, ...changes, id: current.id, createdAt: current.createdAt, updatedAt: new Date().toISOString(), version: current.version + 1 })
    await this.db.transaction('rw', [this.db.weightRecords, this.db.syncOutbox], async () => { await this.db.weightRecords.put(updated); await this.queue.enqueue(updated.userId, 'weightRecords', updated as WeightRecord & Record<string, unknown>) })
    await this.syncProfileWeight(updated.userId)
    return updated
  }

  async deleteWeight(id: string): Promise<void> {
    const current = await this.requireActive<WeightRecord>(this.db.weightRecords, id, 'Kilo kaydı bulunamadı.')
    const now = new Date().toISOString()
    const deleted = weightRecordSchema.parse({ ...current, deletedAt: now, updatedAt: now, version: current.version + 1 })
    await this.db.transaction('rw', [this.db.weightRecords, this.db.syncOutbox], async () => { await this.db.weightRecords.put(deleted); await this.queue.enqueue(deleted.userId, 'weightRecords', deleted as WeightRecord & Record<string, unknown>) })
    await this.syncProfileWeight(current.userId)
  }

  async insertWaist(record: WaistRecord): Promise<WaistRecord> {
    const valid = waistRecordSchema.parse(record)
    await this.db.transaction('rw', [this.db.waistRecords, this.db.syncOutbox], async () => { await this.db.waistRecords.add(valid); await this.queue.enqueue(valid.userId, 'waistRecords', valid as WaistRecord & Record<string, unknown>) })
    return valid
  }

  async updateWaist(id: string, changes: WaistChanges): Promise<WaistRecord> {
    const current = await this.requireActive<WaistRecord>(this.db.waistRecords, id, 'Bel kaydı bulunamadı.')
    const updated = waistRecordSchema.parse({ ...current, ...changes, id: current.id, createdAt: current.createdAt, updatedAt: new Date().toISOString(), version: current.version + 1 })
    await this.db.transaction('rw', [this.db.waistRecords, this.db.syncOutbox], async () => { await this.db.waistRecords.put(updated); await this.queue.enqueue(updated.userId, 'waistRecords', updated as WaistRecord & Record<string, unknown>) })
    return updated
  }

  async deleteWaist(id: string): Promise<void> {
    const current = await this.requireActive<WaistRecord>(this.db.waistRecords, id, 'Bel kaydı bulunamadı.')
    const now = new Date().toISOString()
    const deleted = waistRecordSchema.parse({ ...current, deletedAt: now, updatedAt: now, version: current.version + 1 })
    await this.db.transaction('rw', [this.db.waistRecords, this.db.syncOutbox], async () => { await this.db.waistRecords.put(deleted); await this.queue.enqueue(deleted.userId, 'waistRecords', deleted as WaistRecord & Record<string, unknown>) })
  }

  async upsertManualSteps(record: StepRecord): Promise<StepRecord> {
    if (record.source !== 'manual') throw new Error('Manuel adım upsert yalnızca manual source için kullanılabilir.')
    const existing = await this.db.stepRecords.where('[userId+localDate+source]').equals([record.userId, record.localDate, 'manual']).filter((item) => !item.deletedAt).first()
    if (!existing) {
      const valid = stepRecordSchema.parse(record)
      await this.db.transaction('rw', [this.db.stepRecords, this.db.syncOutbox], async () => { await this.db.stepRecords.add(valid); await this.queue.enqueue(valid.userId, 'stepRecords', valid as StepRecord & Record<string, unknown>) })
      return valid
    }
    const updated = stepRecordSchema.parse({
      ...existing,
      stepCount: record.stepCount,
      measuredAt: record.measuredAt,
      localDate: record.localDate,
      updatedAt: new Date().toISOString(),
      version: existing.version + 1,
    })
    await this.db.transaction('rw', [this.db.stepRecords, this.db.syncOutbox], async () => { await this.db.stepRecords.put(updated); await this.queue.enqueue(updated.userId, 'stepRecords', updated as StepRecord & Record<string, unknown>) })
    return updated
  }

  async updateSteps(id: string, changes: StepChanges): Promise<StepRecord> {
    const current = await this.requireActive<StepRecord>(this.db.stepRecords, id, 'Adım kaydı bulunamadı.')
    if (current.source === 'manual' && current.localDate !== changes.localDate) {
      const conflict = await this.db.stepRecords.where('[userId+localDate+source]').equals([current.userId, changes.localDate, 'manual']).filter((item) => !item.deletedAt && item.id !== id).first()
      if (conflict) throw new Error('Bu gün için zaten manuel adım kaydı var.')
    }
    const updated = stepRecordSchema.parse({ ...current, ...changes, id: current.id, createdAt: current.createdAt, updatedAt: new Date().toISOString(), version: current.version + 1 })
    await this.db.transaction('rw', [this.db.stepRecords, this.db.syncOutbox], async () => { await this.db.stepRecords.put(updated); await this.queue.enqueue(updated.userId, 'stepRecords', updated as StepRecord & Record<string, unknown>) })
    return updated
  }

  async deleteSteps(id: string): Promise<void> {
    const current = await this.requireActive<StepRecord>(this.db.stepRecords, id, 'Adım kaydı bulunamadı.')
    const now = new Date().toISOString()
    const deleted = stepRecordSchema.parse({ ...current, deletedAt: now, updatedAt: now, version: current.version + 1 })
    await this.db.transaction('rw', [this.db.stepRecords, this.db.syncOutbox], async () => { await this.db.stepRecords.put(deleted); await this.queue.enqueue(deleted.userId, 'stepRecords', deleted as StepRecord & Record<string, unknown>) })
  }

  async listWeights(userId: string, startDate?: string, endDate?: string): Promise<WeightRecord[]> {
    const records = startDate && endDate
      ? await this.db.weightRecords.where('[userId+localDate]').between([userId, startDate], [userId, endDate], true, true).filter((record) => !record.deletedAt).toArray()
      : await this.db.weightRecords.where('userId').equals(userId).filter((record) => !record.deletedAt).toArray()
    return records.sort(compareMeasurementRecency)
  }

  async listWaists(userId: string, startDate?: string, endDate?: string): Promise<WaistRecord[]> {
    const records = startDate && endDate
      ? await this.db.waistRecords.where('[userId+localDate]').between([userId, startDate], [userId, endDate], true, true).filter((record) => !record.deletedAt).toArray()
      : await this.db.waistRecords.where('userId').equals(userId).filter((record) => !record.deletedAt).toArray()
    return records.sort(compareMeasurementRecency)
  }

  async listSteps(userId: string, startDate?: string, endDate?: string): Promise<StepRecord[]> {
    if (startDate && endDate) return this.db.stepRecords.where('[userId+localDate]').between([userId, startDate], [userId, endDate], true, true).filter((record) => !record.deletedAt).sortBy('localDate')
    return this.db.stepRecords.where('userId').equals(userId).filter((record) => !record.deletedAt).sortBy('localDate')
  }

  async getLatestWeight(userId: string): Promise<WeightRecord | undefined> {
    return this.getWeightBoundary(userId, 'latest')
  }

  async getStartingWeight(userId: string): Promise<WeightRecord | undefined> {
    return this.getWeightBoundary(userId, 'starting')
  }

  async getLatestWaist(userId: string): Promise<WaistRecord | undefined> {
    return this.getWaistBoundary(userId, 'latest')
  }

  async getStartingWaist(userId: string): Promise<WaistRecord | undefined> {
    return this.getWaistBoundary(userId, 'starting')
  }

  async getManualStepsForDate(userId: string, localDate: string): Promise<StepRecord | undefined> {
    return this.db.stepRecords.where('[userId+localDate+source]').equals([userId, localDate, 'manual']).filter((record) => !record.deletedAt).first()
  }

  private async syncProfileWeight(userId: string) {
    const latest = await this.getLatestWeight(userId)
    const profile = await this.db.userProfiles.get(userId)
    if (!latest || !profile || profile.currentWeightKg === latest.valueKg) return
    const updated = { ...profile, currentWeightKg: latest.valueKg, updatedAt: new Date().toISOString(), version: profile.version + 1 }
    await this.db.transaction('rw', [this.db.userProfiles, this.db.syncOutbox], async () => { await this.db.userProfiles.put(updated); await this.queue.enqueue(userId, 'userProfiles', updated as typeof updated & Record<string, unknown>) })
  }

  private async getWeightBoundary(userId: string, boundary: 'starting' | 'latest') {
    const collection = this.db.weightRecords.where('[userId+measuredAt]').between([userId, Dexie.minKey], [userId, Dexie.maxKey])
    const candidate = await (boundary === 'latest' ? collection.reverse() : collection).filter((record) => !record.deletedAt).first()
    if (!candidate) return undefined
    const tied = await this.db.weightRecords.where('[userId+measuredAt]').equals([userId, candidate.measuredAt]).filter((record) => !record.deletedAt).toArray()
    tied.sort(compareMeasurementRecency)
    return boundary === 'latest' ? tied.at(-1) : tied[0]
  }

  private async getWaistBoundary(userId: string, boundary: 'starting' | 'latest') {
    const collection = this.db.waistRecords.where('[userId+measuredAt]').between([userId, Dexie.minKey], [userId, Dexie.maxKey])
    const candidate = await (boundary === 'latest' ? collection.reverse() : collection).filter((record) => !record.deletedAt).first()
    if (!candidate) return undefined
    const tied = await this.db.waistRecords.where('[userId+measuredAt]').equals([userId, candidate.measuredAt]).filter((record) => !record.deletedAt).toArray()
    tied.sort(compareMeasurementRecency)
    return boundary === 'latest' ? tied.at(-1) : tied[0]
  }

  private async requireActive<T extends { id: string; deletedAt?: string }>(table: { get(id: string): Promise<T | undefined> }, id: string, message: string): Promise<T> {
    const record = await table.get(id)
    if (!record || record.deletedAt) throw new Error(message)
    return record
  }
}
