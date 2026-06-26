import pako from 'pako'
import superjson from 'superjson'
import { type z } from 'zod'

/**
 * Serializes and compresses a value for local storage.
 */
export function serializeAndCompress(value: unknown): string {
  const jsonString = superjson.stringify(value)
  const compressedBuffer = pako.deflate(jsonString)

  // Avoid stack overflow from spread operator on large buffers
  // Using a loop with array join for stack safety and performance
  const binaryArray = new Array(compressedBuffer.length)
  for (let i = 0; i < compressedBuffer.length; i++) {
    binaryArray[i] = String.fromCharCode(compressedBuffer[i])
  }
  const binaryString = binaryArray.join('')

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
    return mergeFn(validated, current)
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

/**
 * Asynchronously saves data to local storage without blocking the main thread.
 *
 * @remarks
 * Uses setTimeout to push the heavy serialization/compression to the next task.
 */
export async function saveAsync(key: string, data: unknown): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const compressed = serializeAndCompress(data)
      localStorage.setItem(key, compressed)
      resolve()
    }, 0)
  })
}

/**
 * Migrator function signature.
 */
export type Migrator<T = any> = (data: any) => T

/**
 * Asynchronously loads data from local storage with versioning support.
 */
export async function loadAsync<T>(
  key: string,
  schema: z.ZodType<T>,
  options?: {
    version?: number
    migrators?: Record<number, Migrator>
  }
): Promise<T | null> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const val = localStorage.getItem(key)
      if (!val) {
        resolve(null)
        return
      }
      try {
        const decompressed = decompressAndDeserialize(val) as any
        let data = decompressed

        // Handle versioned migrations
        const currentVersion = data?.__version ?? 0
        const targetVersion = options?.version ?? 0

        if (currentVersion < targetVersion && options?.migrators) {
          console.log(`[Persist] Migrating ${key} from v${currentVersion} to v${targetVersion}`)
          for (let v = currentVersion + 1; v <= targetVersion; v++) {
            if (options.migrators[v]) {
              data = options.migrators[v](data)
            }
          }
        }

        const validated = schema.parse(data)
        resolve(validated)
      } catch (error) {
        console.error(`[Persist] Error loading key "${key}":`, error)
        resolve(null)
      }
    }, 0)
  })
}
