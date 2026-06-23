/**
 * Signal Tester Utility
 *
 * Proporciona generación de señales sintéticas para validar algoritmos DSP
 * y lógica matemática del dominio.
 */

/**
 * Genera una señal sintética de violín compleja.
 *
 * @remarks
 * Combina una frecuencia fundamental con un segundo armónico con el doble de volumen
 * para probar la robustez del algoritmo ante la duplicación de octava.
 *
 * @param fundamentalHz - Frecuencia fundamental en Hertz.
 * @param sampleRate - Tasa de muestreo (ej. 44100).
 * @param durationSeconds - Duración en segundos.
 *
 * @returns Float32Array con la señal normalizada.
 */
export function generateSyntheticViolinSignal(
  fundamentalHz: number,
  sampleRate: number,
  durationSeconds: number
): Float32Array {
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const buffer = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;

    // Fundamental: A = 1.0
    const fundamental = Math.sin(2 * Math.PI * fundamentalHz * t);

    // Segundo Armónico (Octava): A = 2.0 (como se solicita en la Fase 3)
    const secondHarmonic = 2.0 * Math.sin(2 * Math.PI * (fundamentalHz * 2) * t);

    // Combinar y normalizar al rango [-1.0, 1.0]
    buffer[i] = (fundamental + secondHarmonic) / 3.0;
  }

  return buffer;
}
