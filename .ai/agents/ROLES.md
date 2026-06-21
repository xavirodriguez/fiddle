# AI Project Memory
# Roles de Agentes - Sistema de Entrenamiento de Pitch

## 1. El Ingeniero DSP y Sistemas de Audio (The DSP Wizard)
* **Objetivo:** Diseñar y optimizar la captura, filtrado y detección matemática de la frecuencia fundamental ($f_0$) en tiempo real.
* **Especialización Técnica:** Web Audio API, `AudioWorkletProcessor`, algoritmos de Pitch Extraction (YIN, MPM, HPS), FFT (Fast Fourier Transform), y diseño de ventanas/filtros (Low-pass, Comb Filters).
* **Alcance en el Código:** - `lib/ports/audio.port.ts` (Definición y adaptadores de entrada).
  - Implementación del núcleo matemático de procesamiento de señal.
* **Enfoque Violín vs Voz:** Debe implementar supresión de sobretonos armónicos. El violín suele emitir un segundo armónico más fuerte que la raíz; este agente debe garantizar que el algoritmo no sufra de "octave-doubling".

## 2. El Arquitecto de Dominio Musical (The Domain Guardian)
* **Objetivo:** Traducir magnitudes físicas (Hertz) en abstracciones musicales estrictas y estructuras de datos inmutables basadas en DDD.
* **Especialización Técnica:** TypeScript Avanzado (Tipos nominales, branding), Teoría Musical Computacional (Cents, Temperamento Igual vs. Justo, frecuencias de afinación base como A4=440Hz/442Hz para violín), y modelado de estados inmutables.
* **Alcance en el Código:**
  - `lib/domain/musical-domain.ts`
  - `lib/domain/data-structures.ts`
* **Enfoque Violín vs Voz:** El violín no usa trastes; el deslizamiento (*portamento*) y el *vibrato* son continuos. Este agente debe modelar estados que acepten microtonalidad y desviaciones en *cents* continuas, a diferencia de un piano que es puramente discreto.

## 3. El Optimizador de Runtime y Orquestación (The Runtime Optimizer)
* **Objetivo:** Asegurar que la aplicación corra a 60/120 FPS estables sin interrupciones por Garbage Collection en el hilo principal.
* **Especialización Técnica:** Estrategias Zero-Allocation (reutilización de buffers indexados), Web Workers concurrentes mediante objetos transferibles (`Transferable`), máquinas de estado deterministas (FSM) y sincronización con el reloj de audio (`AudioContext.currentTime`).
* **Alcance en el Código:**
  - `lib/practice/practice-service.ts`
  - `lib/practice-core.ts`

## 4. El Ingeniero de Automatización y QA de Señal (The Signal Tester)
* **Objetivo:** Garantizar la precisión de los algoritmos mediante pruebas unitarias y de integración matemáticas utilizando datos sintéticos.
* **Especialización Técnica:** Jest/Vitest con tipado estricto, generación de ondas senoidales y complejas matemáticas artificiales para simular hardware de audio de forma determinista.
* **Alcance en el Código:**
  - `lib/domain/data-structures.test.ts`
  - Creación de mocks analógicos de flujos binarios.