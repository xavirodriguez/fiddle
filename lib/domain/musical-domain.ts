/**
 * Musical Domain
 *
 * Defines the canonical types and normalization logic for musical concepts
 * shared across the application. This module serves as the source of truth for
 * scientific pitch notation and accidental mapping.
 *
 * @remarks
 * All musical logic in the application follows the standards defined here to
 * ensure consistency between the audio engine, the notation renderer, and
 * the persistence layer.
 */

import { AppError, ERROR_CODES } from '../errors/app-error'

/**
 * Represents a pitch alteration in a canonical numeric format.
 *
 * @remarks
 * This numeric representation is used for internal calculations and
 * pitch-to-frequency mapping.
 *
 * **Canonical Values**:
 * - `-1`: Flat (b)
 * - `0`: Natural
 * - `1`: Sharp (#)
 *
 * @public
 */
export type CanonicalAccidental = -1 | 0 | 1

/** @internal */
const ACCIDENTAL_MAP: Record<string, CanonicalAccidental> = {
  '1': 1,
  sharp: 1,
  '#': 1,
  '2': 1,
  'double-sharp': 1,
  '##': 1,
  '-1': -1,
  flat: -1,
  b: -1,
  '-2': -1,
  'double-flat': -1,
  bb: -1,
  '0': 0,
  natural: 0,
  '': 0,
}

/**
 * Normalizes various accidental representations to the canonical numeric format.
 *
 * @remarks
 * This function handles the variability of accidental representation in
 * different formats (MusicXML, user input, internal constants).
 *
 * **Supported Formats**:
 * - **Numeric**: -1 (flat), 0 (natural), 1 (sharp).
 * - **MusicXML Labels**: "flat", "natural", "sharp", "double-flat", "double-sharp".
 * - **Notation Symbols**: "b", "#", "##", "bb".
 * - **Nullability**: `undefined` are treated as `0` (natural).
 *
 * @param input - Accidental in any supported format.
 *
 * @returns A {@link CanonicalAccidental} (-1, 0, or 1).
 *
 * @throws {@link AppError} with code `DATA_VALIDATION_ERROR` if the input
 *         cannot be mapped to a known accidental.
 *
 * @example
 * ```ts
 * normalizeAccidental(1);        // returns 1
 * normalizeAccidental("#");      // returns 1
 * normalizeAccidental("flat");   // returns -1
 * ```
 *
 * @public
 */
export function normalizeAccidental(input: number | string | undefined): CanonicalAccidental {
  const isUndefined = input === undefined
  if (isUndefined) {
    return handleUndefinedAccidental()
  }

  const result = lookupAccidentalMapping(input)
  const finalAccidental = result

  return finalAccidental
}

function handleUndefinedAccidental(): CanonicalAccidental {
  const defaultAccidental = 0
  const result = defaultAccidental as CanonicalAccidental

  return result
}

function lookupAccidentalMapping(input: number | string): CanonicalAccidental {
  const mappingKey = String(input)
  const mappedValue = ACCIDENTAL_MAP[mappingKey]
  const hasMapping = mappedValue !== undefined

  if (hasMapping) {
    return mappedValue as CanonicalAccidental
  }

  throwUnsupportedAlterError(input)
}

function throwUnsupportedAlterError(input: number | string): never {
  const errorMsg = `Unsupported alter value: ${input}`
  throw new AppError({
    message: errorMsg,
    code: ERROR_CODES.DATA_VALIDATION_ERROR,
  })
}
