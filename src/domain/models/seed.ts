import type { EntityMetadata } from './common'

export interface SeedVersion extends EntityMetadata {
  dataset: 'exercises' | 'foods' | 'recipes' | 'evidence' | 'health_rules' | 'interval_protocols'
  dataVersion: number
  appliedAt: string
}
