export interface EntityMetadata {
  id: string
  createdAt: string
  updatedAt: string
  deletedAt?: string
  version: number
  schemaVersion: number
}

export function createEntityMetadata(now = new Date().toISOString()): EntityMetadata {
  return {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    version: 1,
    schemaVersion: 6,
  }
}
