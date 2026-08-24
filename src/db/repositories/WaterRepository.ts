import { createEntityMetadata, type DailyHydrationTarget, type WaterRecord } from '../../domain/models'
import { dailyHydrationTargetSchema, waterRecordSchema } from '../../validation/phase3bSchemas'
import { SyncQueue } from '../../sync/SyncQueue'
import { appDb, type FormdaDatabase } from '../database'

export class WaterRepository {
  private readonly queue: SyncQueue
  constructor(private readonly db: FormdaDatabase = appDb) { this.queue = new SyncQueue(db) }

  async add(record: WaterRecord) {
    const valid = waterRecordSchema.parse(record)
    await this.db.transaction('rw', [this.db.waterRecords, this.db.syncOutbox], async () => {
      await this.db.waterRecords.add(valid)
      await this.queue.enqueue(valid.userId, 'waterRecords', valid as WaterRecord & Record<string, unknown>)
    })
    return valid
  }

  async addFromShortcut(record: WaterRecord, actionId: string) {
    return this.db.transaction('rw', [this.db.waterRecords, this.db.shortcutActionReceipts, this.db.syncOutbox], async () => {
      const receipt = await this.db.shortcutActionReceipts.where('actionId').equals(actionId).first()
      if (receipt) return { record: await this.db.waterRecords.get(receipt.id), duplicate: true as const }
      const valid = waterRecordSchema.parse(record)
      await this.db.waterRecords.add(valid)
      await this.db.shortcutActionReceipts.add({ ...createEntityMetadata(valid.createdAt), id: valid.id, userId: valid.userId, actionId, action: 'water', amountMl: valid.amountMl, processedAt: valid.createdAt })
      await this.queue.enqueue(valid.userId, 'waterRecords', valid as WaterRecord & Record<string, unknown>)
      return { record: valid, duplicate: false as const }
    })
  }

  async update(id: string, amountMl: number, consumedAt: string, localDate: string) {
    const current = await this.db.waterRecords.get(id)
    if (!current || current.deletedAt) throw new Error('Su kaydı bulunamadı.')
    const updated = waterRecordSchema.parse({ ...current, amountMl, consumedAt, localDate, updatedAt: new Date().toISOString(), version: current.version + 1 })
    await this.db.transaction('rw', [this.db.waterRecords, this.db.syncOutbox], async () => {
      await this.db.waterRecords.put(updated)
      await this.queue.enqueue(updated.userId, 'waterRecords', updated as WaterRecord & Record<string, unknown>)
    })
    return updated
  }

  async remove(id: string) {
    const current = await this.db.waterRecords.get(id)
    if (!current || current.deletedAt) throw new Error('Su kaydı bulunamadı.')
    const now = new Date().toISOString()
    const deleted = waterRecordSchema.parse({ ...current, deletedAt: now, updatedAt: now, version: current.version + 1 })
    await this.db.transaction('rw', [this.db.waterRecords, this.db.syncOutbox], async () => {
      await this.db.waterRecords.put(deleted)
      await this.queue.enqueue(deleted.userId, 'waterRecords', deleted as WaterRecord & Record<string, unknown>)
    })
  }

  async listForDate(userId: string, localDate: string) {
    return (await this.db.waterRecords.where('[userId+localDate]').equals([userId, localDate]).filter((record) => !record.deletedAt).sortBy('consumedAt')).reverse()
  }

  async totalForDate(userId: string, localDate: string) {
    return (await this.listForDate(userId, localDate)).reduce((sum, record) => sum + record.amountMl, 0)
  }

  async getTarget(userId: string, localDate: string) { return this.db.dailyHydrationTargets.where('[userId+localDate]').equals([userId, localDate]).first() }

  async putTarget(target: DailyHydrationTarget) {
    const valid = dailyHydrationTargetSchema.parse(target)
    await this.db.transaction('rw', [this.db.dailyHydrationTargets, this.db.syncOutbox], async () => {
      await this.db.dailyHydrationTargets.put(valid)
      await this.queue.enqueue(valid.userId, 'dailyHydrationTargets', valid as DailyHydrationTarget & Record<string, unknown>)
    })
    return valid
  }
}
