import { z } from 'zod'

/**
 * Schema for a completed practice session.
 */
export const PracticeSessionRecordSchema = z.object({
  id: z.string().uuid(),
  exerciseId: z.string(),
  timestamp: z.number(), // Date.now() is fine for non-musical persistence
  score: z.number(),
  accuracyPercentage: z.number(),
  mostDifficultNote: z.string().optional(),
  durationSeconds: z.number(),
})

export type PracticeSessionRecord = z.infer<typeof PracticeSessionRecordSchema>

/**
 * Schema for microphone and hardware calibration.
 */
export const CalibrationSchema = z.object({
  noiseGateThreshold: z.number(),
  estimatedLatencyMs: z.number(),
  lastCalibrated: z.number(),
})

export type Calibration = z.infer<typeof CalibrationSchema>

/**
 * Schema for global user history.
 */
export const SessionHistorySchema = z.object({
  sessions: z.array(PracticeSessionRecordSchema),
  lastUpdated: z.number(),
})

export type SessionHistory = z.infer<typeof SessionHistorySchema>

/** Valor deserializado desde el storage comprimido. Puede ser null si no existe. */
export type DeserializedStorageValue = Record<string, unknown> | null | undefined
