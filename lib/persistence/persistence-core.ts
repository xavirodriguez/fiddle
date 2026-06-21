import { z } from 'zod'
import superjson from 'superjson'
import pako from 'pako'

/**
 * Serializes and compresses a value for local storage.
 */
export function serializeAndCompress(value: unknown): string {
  const jsonString = superjson.stringify(value)
  const compressedBuffer = pako.deflate(jsonString)
  const binaryString = String.fromCharCode(...compressedBuffer)
  const base64String = btoa(binaryString)
  const result = base64String

  return result
}

/**
 * Decompresses and deserializes a value from local storage.
 */
export function decompressAndDeserialize(val: string): unknown {
  const binaryData = atob(val)
  const bytes = Uint8Array.from(binaryData, (c) => c.charCodeAt(0))
  const decompressedJson = pako.inflate(bytes, { to: 'string' })
  const result = superjson.parse(decompressedJson)

  return result
}

function handleValidationError(name: string, error: unknown): void {
  const prefix = `[Persist] ❌ Validation failed for ${name}.`
  const suffix = 'Falling back to default state.'
  const message = `${prefix} ${suffix}`
  const errorObj = error

  console.error(message, errorObj)
}

function mergeState<T>(validated: T, current: T, mergeFn?: (p: T, c: T) => T): T {
  const hasCustomMerge = !!mergeFn
  if (hasCustomMerge) {
    return mergeFn!(validated, current)
  }
  const merged = { ...current, ...validated }
  const result = merged

  return result
}

/**
 * Validates and merges persisted state with current state.
 */
export function validateAndMerge<T>(
  schema: z.ZodType<T>,
  persistedState: unknown,
  currentState: T,
  options: {
    name: string
    merge?: (persisted: T, current: T) => T
  },
): T {
  const isMissing = persistedState == undefined
  if (isMissing) {
    return currentState
  }

  return executeValidationAndMerge({ schema, persistedState, currentState, options })
}

function executeValidationAndMerge<T>(params: {
  schema: z.ZodType<T>
  persistedState: unknown
  currentState: T
  options: { name: string; merge?: (p: T, c: T) => T }
}): T {
  const { schema, persistedState, currentState, options } = params
  try {
    const validated = schema.parse(persistedState)
    const logMsg = `[Persist] ✅ State validated for ${options.name}`
    console.log(logMsg)
    return mergeState(validated, currentState, options.merge)
  } catch (validationError) {
    handleValidationError(options.name, validationError)
    return currentState
  }
}
