# AI Project Memory

# 📋 Backlog Maestro de Desarrollo: Sistema de Detección de Pitch de Ultra-Baja Latencia

## 🌌 Fase 1: Fundaciones del Dominio y Tipado Estricto

**Objetivo:** Crear el núcleo matemático e inmutable del negocio musical libre de dependencias externas.
**Asignado a:** `Domain Guardian`

* [x] **1.1. Modelado de Tipos Nominales (TypeScript Branding) en `lib/domain/musical-domain.ts**`
* [x] Implementar tipos marcados para evitar mezclar magnitudes físicas: `type Hertz = number & { __brand: "Hertz" }`, `type Cents = number & { __brand: "Cents" }`, y `type MidiNote = number & { __brand: "Midi" }`.
* [x] Crear funciones de fábrica puras con validación integrada para asegurar que ningún hercio sea negativo o infinito.


* [x] **1.2. Sistema de Ajuste de Afinación Base (A4 Calibration)**
* [x] Diseñar la estructura de configuración para soportar frecuencias base variables (`A4 = 440Hz` para voz popular, `A4 = 442Hz` o `443Hz` común en orquestas de violín).
* [x] Escribir convertidores bidireccionales matemáticos exactos:
* [x] $f \rightarrow \text{MIDI}$: $\text{midi} = 12 \cdot \log_2(f / \text{A4}) + 69$.
* [x] $\text{MIDI} \rightarrow f$: $f = \text{A4} \cdot 2^{(\text{midi} - 69)/12}$.




* [x] **1.3. Abstracciones de Análisis Microtonal en `lib/domain/data-structures.ts**`
* [x] Crear la estructura `PitchFrame` que contenga: `frequency`, `centsDeviation`, `confidence` y `timestamp`.
* [x] Definir el umbral de tolerancia para el violín (rango dinámico continuo de desafinación en lugar de rejilla discreta de piano).



---

## 🔊 Fase 2: Infraestructura de Audio y Pipeline DSP (Entrada de Hardware)

**Objetivo:** Capturar la señal cruda, aislar los armónicos y procesarla en un hilo secundario sin latencia.
**Asignado a:** `DSP Wizard`

* [x] **2.1. Definición de Contratos en `lib/ports/audio.port.ts**`
* [x] Declarar la interfaz `AudioCapturePort` con métodos para `initialize()`, `startStream()`, `stopStream()` y sus respectivos listeners de eventos de cambio de hardware.
* [x] Declarar la interfaz `PitchDetectorWorkerPort` para definir el intercambio de datos con el hilo asíncrono.


* [ ] **2.2. Implementación del Grafo de Nodos Web Audio API**
* [ ] Configurar el nodo `BiquadFilterNode` adaptativo. *Nota para violín:* El rango del violín va desde la cuerda Sol (G3 = 196Hz) hasta armónicos altos (E7 = 2637Hz). El filtro paso-bajo debe ajustarse dinámicamente según el ejercicio elegido en lugar de ser fijo.
* [ ] Configurar el `DynamicsCompressorNode` para atenuar los ataques agresivos del arco del violín y estabilizar el aire en la voz.


* [ ] **2.3. Creación del Web Worker Concurrente (`PitchWorker.ts`)**
* [ ] Implementar la infraestructura de paso de mensajes usando **Transferable Objects** (`ArrayBuffer`) para evitar la clonación de memoria a 60 FPS.
* [ ] **Sub-tarea Crítica (Algoritmo MPM/YIN):** Implementar el cálculo de la Función de Diferencia de Magnitud Promedio (AMDF) para combatir la duplicación de octava provocada por el fuerte segundo armónico del violín.
* [ ] Incorporar la **Puerta de Ruido (Noise Gate)** basada en el cálculo instantáneo de la energía RMS del buffer.



---

## 🧪 Fase 3: Automatización y QA de Señal Matemática

**Objetivo:** Asegurar mediante pruebas con datos sintéticos que el motor detecta notas reales antes de tocar instrumentos en vivo.
**Asignado a:** `Signal Tester`

* [x] **3.1. Implementación de Pruebas Unitarias Estrictas en `lib/domain/data-structures.test.ts**`
* [x] Validar conversiones de hercios extremos a notas MIDI (ej. G3, E7, C4).
* [x] Comprobar que los cálculos de *cents* manejen desviaciones tanto positivas (agudo) como negativas (grave) con precisión de 4 decimales.


* [ ] **3.2. Generador de Señales Sintéticas de Prueba**
* [ ] Escribir un script utilitario que llene un `Float32Array` con ondas senoidales perfectas (ej. 440Hz puro) y verificar que el Worker devuelva exactamente la nota A4 con confianza $> 0.98$.
* [ ] **Test de Estrés de Violín:** Generar una señal compuesta que simule un violín desafinado: mezclar una frecuencia fundamental de 220Hz con un armónico de 440Hz que tenga el doble de volumen. Verificar que el algoritmo detecte 220Hz (A3) y no caiga en el error de la octava superior.



---

## 🎮 Fase 4: Orquestación de Gameplay y Sincronización Determinista

**Objetivo:** Unir el flujo de datos de audio con el progreso del ejercicio en el tiempo exacto de la tarjeta de sonido.
**Asignado a:** `Runtime Optimizer`

* [x] **4.1. Desarrollo del Motor de Línea de Timeline en `lib/practice/practice-service.ts**`
* [x] Implementar la carga y parseo eficiente de estructuras JSON musicales.
* [x] **Sincronización Maestra:** Vincular todas las consultas temporales al reloj de hardware `AudioContext.currentTime`. Queda estrictamente prohibido usar `performance.now()` o `Date.now()` para la posición del mapa.


* [x] **4.2. Estrategia de Asignación de Memoria Cero (Zero-Allocation Loop) en `lib/practice-core.ts**`
* [x] Pre-alojar en memoria dos buffers (`Float32Array`) cíclicos compartidos. Mientras el Worker procesa el Buffer A, el hilo principal llena el Buffer B.
* [x] Eliminar cualquier uso de `Object.assign`, spread operator (`...`), o inicialización de vectores dentro del loop principal. Reutilizar instancias mutando propiedades primitivas.


* [x] **4.3. Algoritmo de Interpolación Suave (Lerp) para la UI**
* [x] Diseñar el amortiguador matemático para la frecuencia detectada. Si la voz titubea microtonalmente, aplicar una interpolación lineal de paso bajo para suavizar el movimiento del avatar visual en pantalla, evitando comportamientos nerviosos o parpadeos.



---

## 💾 Fase 5: Persistencia de Sesión y Calibración Histórica

**Objetivo:** Almacenar de forma segura el perfil físico de afinación del usuario y sus estadísticas de práctica.
**Asignado a:** `Infrastructure Engineer` (En coordinación con el Domain Guardian)

* [x] **5.1. Definición de Esquemas en `lib/persistence/storage-types.ts**`
* [x] Definir el tipo estructurado para guardar las sesiones de práctica (`PracticeSessionRecord`): puntaje total, porcentaje de precisión en el tono, nota con mayor dificultad detectada y duración.
* [x] Definir el esquema para el perfil de calibración del micrófono (umbral personalizado de la puerta de ruido y latencia estimada del hardware del usuario).


* [x] **5.2. Implementación del Núcleo de Almacenamiento en `lib/persistence/persistence-core.ts**`
* [x] Desarrollar el adaptador concreto para `LocalStorage` o `IndexedDB` encapsulado tras las firmas del puerto.
* [x] Garantizar operaciones de lectura/escritura asíncronas para evitar bloqueos del hilo principal del juego durante el autoguardado.

---

## 🛠️ Fase 6: Modernización y Sustitución por Librerías Especializadas

**Objetivo:** Reducir deuda técnica y aumentar la robustez mediante la integración de estándares de la industria.
**Asignado a:** `Systems Architect`

* [ ] **6.1. Refactorización de Estructuras de Datos (Domain)**
    * [ ] Sustituir `FixedRingBuffer` por `CircularBuffer` de `mnemonist` en `lib/domain/data-structures.ts`.
    * [ ] Validar que la semántica de "front-insertion" se mantenga o se adapte correctamente en los consumidores.

* [ ] **6.2. Integración de Manejo Funcional de Errores e Inmutabilidad (Application)**
    * [ ] Refactorizar `lib/practice-core.ts` para usar `neverthrow` (`Result`, `ok`, `err`) en lugar de excepciones imperativas.
    * [ ] Implementar `immer` (`produce`) en el reducer `reducePracticeEvent` para eliminar spreads manuales.

* [ ] **6.3. Pipeline Reactivo y Máquinas de Estado (Application/Infrastructure)**
    * [ ] Diseñar el `AudioPipeline` usando `rxjs` en `lib/ports/audio.port.ts`.
    * [ ] Implementar `xstate` para el `NoteSegmenter` (SILENCE ↔ NOTE) y el ciclo de vida de la sesión.

* [ ] **6.4. Análisis Estadístico y Extracción de Features (Domain/Infrastructure)**
    * [ ] Sustituir cálculos manuales de desviación y regresión por `simple-statistics` en el `TechniqueAgent`.
    * [ ] Integrar `meyda` para el análisis espectral y `pitchy` para el algoritmo de detección YIN/MPM.

* [ ] **6.5. Motor de Audio y Persistencia Reactiva (Infrastructure/Adapters)**
    * [ ] Migrar el metrónomo y scheduling a `tone.js`.
    * [ ] Consolidar los stores de Zustand en Slices o migrar a `@tanstack/store`.
