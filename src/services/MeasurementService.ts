import { createEntityMetadata, type StepRecord, type WaistRecord, type WeightRecord } from '../domain/models'
import { MeasurementRepository } from '../db/repositories'
import { localDateTimeToIso } from '../utils/localDate'
import { stepInputSchema, waistInputSchema, weightInputSchema } from '../validation/measurementSchemas'

export type MeasurementKind = 'weight' | 'waist' | 'steps'

export class MeasurementService {
  constructor(private readonly repository = new MeasurementRepository()) {}

  async saveWeight(userId: string, input: unknown, existing?: WeightRecord) {
    const values = weightInputSchema.parse(input)
    const measuredAt = localDateTimeToIso(values.localDate, values.time)
    if (existing) return this.repository.updateWeight(existing.id, { valueKg: values.valueKg, measuredAt, localDate: values.localDate, note: values.note || undefined })
    return this.repository.insertWeight({ ...createEntityMetadata(), userId, valueKg: values.valueKg, measuredAt, localDate: values.localDate, source: 'manual', note: values.note || undefined })
  }

  async saveWaist(userId: string, input: unknown, existing?: WaistRecord) {
    const values = waistInputSchema.parse(input)
    const measuredAt = localDateTimeToIso(values.localDate, values.time)
    if (existing) return this.repository.updateWaist(existing.id, { valueCm: values.valueCm, measuredAt, localDate: values.localDate, note: values.note || undefined })
    return this.repository.insertWaist({ ...createEntityMetadata(), userId, valueCm: values.valueCm, measuredAt, localDate: values.localDate, source: 'manual', note: values.note || undefined })
  }

  async saveSteps(userId: string, input: unknown, existing?: StepRecord) {
    const values = stepInputSchema.parse(input)
    const measuredAt = localDateTimeToIso(values.localDate, '12:00')
    if (existing) return this.repository.updateSteps(existing.id, { stepCount: values.stepCount, measuredAt, localDate: values.localDate })
    return this.repository.upsertManualSteps({ ...createEntityMetadata(), userId, stepCount: values.stepCount, measuredAt, localDate: values.localDate, source: 'manual' })
  }

  async delete(kind: MeasurementKind, id: string) {
    if (kind === 'weight') return this.repository.deleteWeight(id)
    if (kind === 'waist') return this.repository.deleteWaist(id)
    return this.repository.deleteSteps(id)
  }
}
