# Registro de Decisiones Arquitectónicas (ADRs)

Este documento rastrea las decisiones técnicas críticas adoptadas para estabilizar y modernizar el sistema.

## ADR 001: Migración del Procesamiento de Audio a AudioWorklet
* **Contexto:** El uso de `requestAnimationFrame` (RAF) y `AnalyserNode` en el hilo principal causaba pérdida de frames, latencia y bloqueos en la UI durante la recolección de basura (Garbage Collection).
* **Decisión:** Mover todo el procesamiento de la señal cruda (cálculo RMS, compresión y algoritmo YIN) a un `AudioWorkletProcessor` nativo.
* **Consecuencias:** Reduce la latencia a <25ms y libera el hilo principal para animaciones a 60 FPS. Requiere serializar los resultados (`PitchDetectionResult`) mediante paso de mensajes.

## ADR 002: Adopción de Librerías DSP Especializadas
* **Contexto:** Mantener ~1000 líneas de código matemático manual (YIN, autocorrelación, estadísticas) era propenso a errores y difícil de testear para casos borde del violín.
* **Decisión:** Reemplazar implementaciones manuales con `pitchy` (detección de tono) y `meyda` (extracción de features).
* **Consecuencias:** Reducción drástica del tamaño del repositorio, mayor precisión matemática respaldada por la comunidad y estandarización del pipeline de entrada.

## ADR 003: Persistencia Segura y Escalable
* **Contexto:** El uso de `localStorage` mediante Zustand persist estaba al borde de saturar el límite de 5MB del navegador con los historiales de sesión.
* **Decisión:** Migrar el almacenamiento pesado (analíticas, historiales de notas) a `IndexedDB`.
* **Consecuencias:** Almacenamiento virtualmente ilimitado en el cliente. Requiere manejar asincronía en la carga inicial del estado.

## ADR 004: Orquestación Reactiva y Máquinas de Estado
* **Contexto:** El `PracticeStore` mezclaba estado global de UI con lógica de hardware y bucles asíncronos frágiles (AsyncGenerators y booleanos anidados).
* **Decisión:** Implementar `XState` para el control de flujo y `RxJS` para el pipeline de eventos de audio continuos.
* **Consecuencias:** Transiciones de estado predecibles, manejo elegante de la "contrapresión" (backpressure) de eventos de audio, y eliminación de bugs de concurrencia.