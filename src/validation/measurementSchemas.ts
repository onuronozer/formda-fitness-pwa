import { z } from 'zod'
import { MEASUREMENT_SOURCES } from '../domain/enums'
import { entityMetadataSchema } from './profileSchemas'

export const weightRecordSchema = entityMetadataSchema.extend({
  userId: z.string().uuid(),
  valueKg: z.number().min(30).max(350),
  measuredAt: z.string().datetime({ offset: true }),
  localDate: z.string().date(),
  source: z.enum(MEASUREMENT_SOURCES),
  note: z.string().max(500).optional(),
})

export const waistRecordSchema = entityMetadataSchema.extend({
  userId: z.string().uuid(),
  valueCm: z.number().min(40).max(250),
  measuredAt: z.string().datetime({ offset: true }),
  localDate: z.string().date(),
  source: z.enum(MEASUREMENT_SOURCES),
  note: z.string().max(500).optional(),
})

export const stepRecordSchema = entityMetadataSchema.extend({
  userId: z.string().uuid(),
  stepCount: z.number().int().min(0).max(200_000),
  measuredAt: z.string().datetime({ offset: true }),
  localDate: z.string().date(),
  source: z.enum(MEASUREMENT_SOURCES),
})

export const weightInputSchema = z.object({
  valueKg: z.coerce.number().min(30, 'Kilo en az 30 kg olmalı.').max(350, 'Kilo en fazla 350 kg olabilir.'),
  localDate: z.string().date('Geçerli bir tarih seç.'),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Geçerli bir saat seç.'),
  note: z.string().trim().max(120, 'Not en fazla 120 karakter olabilir.').optional(),
})

export const waistInputSchema = z.object({
  valueCm: z.coerce.number().min(40, 'Bel çevresi en az 40 cm olmalı.').max(250, 'Bel çevresi en fazla 250 cm olabilir.'),
  localDate: z.string().date('Geçerli bir tarih seç.'),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Geçerli bir saat seç.'),
  note: z.string().trim().max(120, 'Not en fazla 120 karakter olabilir.').optional(),
})

export const stepInputSchema = z.object({
  stepCount: z.coerce.number().int('Adım tam sayı olmalı.').min(0, 'Adım sıfırdan küçük olamaz.').max(200_000, 'Adım değeri çok yüksek.'),
  localDate: z.string().date('Geçerli bir tarih seç.'),
})
