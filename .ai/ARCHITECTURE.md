# Arquitectura del Sistema: Violin Mentor

## 1. Visión General
Violin Mentor utiliza una **Arquitectura Hexagonal (Puertos y Adaptadores)** estricta, diseñada para un entorno de ultra-baja latencia (Audio Web). El objetivo principal es aislar completamente la lógica del dominio musical de las APIs del navegador (Web Audio API, DOM, Storage) y de las librerías de UI (React).

## 2. Gobernanza de Capas y Librerías

### Capa de Dominio (Domain Layer)
El núcleo matemático e inmutable. No tiene dependencias externas excepto utilidades puras.
* **Responsabilidad:** Reglas de teoría musical, cálculo de cents, estructuras de datos inmutables y validación de tipos.
* **Librerías Permitidas:**
  * `simple-statistics`: Para cálculos matemáticos puros (desviación, regresión).
  * `mnemonist`: Para estructuras de datos eficientes (`CircularBuffer`).
  * `neverthrow`: Para manejo de errores funcional (`Result<T, E>`), prohibiendo el uso de `throw` en tiempo de ejecución.

### Capa de Aplicación (Application Layer)
Orquesta el flujo de datos y los casos de uso, pero no sabe que existe React o la Web Audio API.
* **Responsabilidad:** Máquinas de estado de la sesión, pipelines de eventos y consolidación de datos.
* **Librerías Permitidas:**
  * `xstate`: Para máquinas de estado deterministas (ej. segmentación de notas).
  * `rxjs`: Para el manejo declarativo del pipeline de eventos de audio.
  * `immer`: Para mutaciones seguras del estado inmutable.
  * `@tanstack/store` (o Zustand centralizado): Para el estado global.

### Capa de Infraestructura (Infrastructure & Adapters)
Se comunica con el "mundo exterior" (hardware, APIs del navegador, bases de datos).
* **Responsabilidad:** Captura de micrófono, ejecución de algoritmos DSP, persistencia de datos.
* **Librerías Permitidas:**
  * `pitchy`: Para la detección del pitch (algoritmo YIN/McLeod).
  * `meyda`: Para extracción de características de audio (RMS, ZCR).
  * `tone.js`: Para el metrónomo y scheduling de audio.
  * `idb-keyval` / `Dexie.js`: Para persistencia en IndexedDB.

### Capa de Presentación (UI Layer)
* **Responsabilidad:** Renderizado visual y captura de interacciones del usuario.
* **Restricción:** OSMD (`OpenSheetMusicDisplay`) debe ser cargado perezosamente (`lazy loading`) para no bloquear el hilo principal en el arranque.

## 3. Mandatos Críticos de Rendimiento (Guardrails)

1. **Bucle de Audio Desacoplado:** Todo procesamiento DSP (`pitchy`, `meyda`) debe ejecutarse en un hilo secundario mediante un `AudioWorkletProcessor`.
2. **Zero-Allocation en Runtime:** Dentro del bucle crítico a 60 FPS o en el Worklet, queda prohibida la creación dinámica de objetos (`{}`), arrays (`[]`) o el uso de la palabra clave `new`. Se deben reutilizar buffers pre-alojados.
3. **Sincronización Determinista:** El reloj maestro del juego es EXCLUSIVAMENTE `AudioContext.currentTime`. Queda prohibido el uso de `Date.now()` o `performance.now()` para coordinar eventos musicales.