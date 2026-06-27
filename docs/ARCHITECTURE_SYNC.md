# Arquitectura de Sincronización Musical en Tiempo Real

Este documento detalla la orquestación del sistema de práctica musical, diseñado para alta precisión (sample-accurate) y rendimiento de 60 FPS sin jitter.

## Orquestación del Sistema

1.  **Carga de MusicXML**: El usuario selecciona o carga una partitura.
2.  **Renderizado OSMD**: `ScoreViewer` recibe el XML y utiliza `OpenSheetMusicDisplay` para generar el SVG/Canvas. Se extraen las métricas de las notas para la sincronización.
3.  **Compilación de Timeline**: El `TimelineSynchronizer` transforma las notas musicales (figuras) en eventos absolutos en segundos (`MusicalEvent[]`), utilizando el BPM configurado.
4.  **Inicio de Transporte**: `Tone.Transport` se inicia, sincronizado al `AudioContext` compartido mediante `ToneBridge`.
5.  **Programación de Eventos**: `TimelineSynchronizer.schedule` registra callbacks en el transporte de Tone.js para cada nota.
6.  **Ejecución de Callback**: Al llegar el tiempo exacto de una nota:
    -   Se llama a `ScoreViewer.nextStep()` (API imperativa) para mover el cursor visual sin disparar re-renders de React.
    -   Se actualiza el `syncState` en el store para informar a la UI sobre la nota objetivo actual.
7.  **Captura DSP**: El `WebAudioAdapter` captura el audio del micrófono mediante un `AudioWorkletNode` para mínima latencia.
8.  **Detección de Tono**: El motor de DSP (MPM + Meyda) extrae la frecuencia fundamental y la convierte a MIDI RAW.
9.  **Verificación Determinista**: `TimelineSynchronizer.verify()` compara en O(1) la nota detectada contra la nota esperada según el reloj de audio actual.
10. **Feedback Visual**: El store de Zustand actualiza el estado de precisión (`isCorrectPitch`), lo que permite que componentes optimizados (vía suscripción directa o refs) muestren feedback en tiempo real.

## Diagramas de Flujo y Dependencias

### Flujo de Datos
```text
[Micrófono] -> [WebAudioAdapter] -> [PitchDetector] -> [PracticeService]
                                                            |
                                                            v
[MusicXML] -> [ScoreViewer] <--- [TimelineSynchronizer] <--- [Tone.Transport]
                                            |
                                            v
                                      [PracticeStore] -> [React UI]
```

### Flujo Temporal
```text
Reloj de Audio (Hardware) [0.0s] --- [0.5s] --- [1.0s] --- [1.5s] --->
Tone.Transport            | Evento 1| Evento 2| Evento 3| Evento 4|
Cursor Visual             | Nota 1  | Nota 2  | Nota 3  | Nota 4  |
Ciclo de Análisis DSP     | Detect  | Detect  | Detect  | Detect  | (cada ~10ms)
```

### Dependencias entre Módulos
```text
PracticeService (Orquestador)
 ├── TimelineSynchronizer (Lógica temporal)
 ├── ToneBridge (Tone.js <-> AudioContext)
 ├── AudioPipeline (Flujo RxJS de Pitch)
 └── PracticeMachine (FSM de sesión XState)

ScoreViewer (OSMD)
 └── React (Puente Imperativo via useRef)

PracticeStore (Zustand + Immer)
 └── React UI (Suscripciones selectivas)
```

### Hilos Lógicos de Ejecución
```text
Hilo Principal (Main Thread):
 - Renderizado UI (Framer Motion / Tailwind)
 - Lógica de Zustand y XState
 - Manipulación imperativa de OSMD (SVG/Canvas)

Hilo de Audio (Audio Worklet):
 - Captura de PCM
 - Noise Gate (Puerta de ruido)
 - Análisis espectral inicial (Meyda)

Pipeline de Pitch (RxJS):
 - Procesamiento de alta frecuencia (suavizado, estadísticas)
 - Verificación de técnica (vibrato, estabilidad)
```
