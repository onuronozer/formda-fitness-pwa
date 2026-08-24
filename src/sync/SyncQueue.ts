import { createEntityMetadata, type EntityMetadata, type SyncEntityType, type SyncOutboxEvent } from '../domain/models'
import { syncOutboxEventSchema } from '../validation/phase3bSchemas'
import { appDb, type FormdaDatabase } from '../db/database'

export class SyncQueue {
  constructor(private readonly db: FormdaDatabase = appDb) {}

  async enqueue(userId: string, entityType: SyncEntityType, entity: EntityMetadata & Record<string, unknown>) {
    const operation = entity.deletedAt ? 'delete' as const : 'upsert' as const
    const idempotencyKey = `${entityType}:${entity.id}:v${entity.version}:${operation}`
    const existing = await this.db.syncOutbox.where('idempotencyKey').equals(idempotencyKey).first()
    if (existing) return existing
    const now = new Date().toISOString()
    const event: SyncOutboxEvent = syncOutboxEventSchema.parse({
      ...createEntityMetadata(now), userId, entityType, entityId: entity.id, operation,
      payload: structuredClone(entity), status: 'pending', attempts: 0, nextAttemptAt: now, idempotencyKey,
    })
    await this.db.syncOutbox.add(event)
    return event
  }

  async listReady(userId: string, now = new Date().toISOString()) {
    return this.db.syncOutbox.where('[userId+status]').anyOf([[userId, 'pending'], [userId, 'error']]).filter((event) => event.nextAttemptAt <= now).sortBy('createdAt')
  }
}
