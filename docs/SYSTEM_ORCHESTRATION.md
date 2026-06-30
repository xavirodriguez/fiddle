# Sistema de Práctica Musical en Tiempo Real: Orquestación y Arquitectura

Este documento detalla la arquitectura y el flujo de ejecución del motor de sincronización musical.

## 1. Diagrama de Flujo de Datos

```ascii
+-------------------+       MusicXML       +-----------------------+
|  Usuario (Carga)  | -------------------> |  ScoreViewer (OSMD)   |
+-------------------+                      +-----------------------+
          |                                            |
          |                                            v
          |      Propiedades de Notas      +-----------------------+
          +------------------------------> | TimelineSynchronizer  |
                                           |      (Compilación)    |
                                           +-----------------------+
                                                       |
                                                       v
                                           +-----------------------+
                                           |   Eventos Musicales   |
                                           | (Midi, Start, Dur)    |
                                           +-----------------------+
                                                       |
                                                       v
+-------------------+                      +-----------------------+
|  Audio Hardware   | <--- Sincronía ----> |    Tone.Transport     |
| (Microphone)      |      Clock           |      (Scheduler)      |
+-------------------+                      +-----------------------+
          |                                            |
          v                                            v
+-------------------+                      +-----------------------+
| CaptureProcessor  |                      | Callback de Evento    |
| (AudioWorklet)    |                      | (Avanzar Cursor)      |
+-------------------+                      +-----------------------+
          |                                            |
          v (PitchFrame)                               v
+--------------------------------------------------------------+
|                      PracticeService (Orquestador)           |
+--------------------------------------------------------------+
          |                        |
          v (Verificación)         v (Actualización)
+-------------------+      +-----------------------+
| TimelineSync.verify|      |     Zustand Store     |
+-------------------+      +-----------------------+
                                        |
                                        v
                           +-----------------------+
                           |   Feedback UI (60fps) |
                           +-----------------------+
```

## 2. Flujo Temporal (Temporal Reference)

La **Fuente de Verdad Temporal Única** es el `AudioContext.currentTime`.

```ascii
AudioContext (Hardware Clock)
|
|-- 0.000s: Tone.Transport.start()
|
|-- 0.500s: [Nota 1] Evento Programado (Tone.Transport.schedule)
|           |--> ScoreViewer.nextStep() (Visual)
|           |--> PracticeService.setTarget(Midi)
|
|-- 0.516s: Frame de Audio Recibido (Latencia ~16ms)
|           |--> PracticeService.processFrame(timestamp: 0.516)
|           |--> synchronizer.verify(0.516, midi) -> { isCorrectPitch: true }
|           |--> FeedbackOverlay actualiza posición de aguja (Imperativo)
|
|-- 1.000s: [Nota 2] Evento Programado
|           |--> ScoreViewer.nextStep()
|           |--> PracticeService.setTarget(Midi)
```

## 3. Dependencias entre Módulos

```ascii
[UI Layer]
      |
      v
[PracticeService (Application)]
      |
      +-----> [AudioPipeline (Domain/Infra)]
      |             |
      |             +-----> [TechniqueAgent]
      |
      +-----> [TimelineSynchronizer (Domain)]
      |
      +-----> [WebAudioAdapter (Infra)]
      |             |
      |             +-----> [CaptureProcessor (Worklet)]
      |
      +-----> [ToneBridge (Infra)]
                    |
                    +-----> [Tone.js / Native AudioContext]
```

## 4. Hilos Lógicos de Ejecución

### Main Thread (UI/Orquestación)
- React 19 (Rendering asíncrono).
- OSMD (Cálculos de layout SVG).
- RxJS (Pipeline de eventos a 60-100Hz).
- XState (Máquina de estados de práctica).
- Zustand (Estado observable de la sesión).

### Audio Thread (Web Audio Worklet)
- `CaptureProcessor.js`: Captura de buffers de entrada.
- `pitchy`: Algoritmo de detección de frecuencia (MPM).
- `meyda`: Extracción de características (RMS, Spectral Flatness).
- *Zero-allocation* estricto para evitar micro-cortes por GC.

### Tone.js Scheduler (Worker Interno/Clock)
- Gestión de `look-ahead` para programación sample-accurate.
- Disparo de callbacks de transporte.

---

## Decisiones de Diseño Clave

1. **API Imperativa en ScoreViewer**:
   React no debe controlar el movimiento del cursor. El scheduler musical llama directamente a `scoreRef.current.nextStep()`. Esto evita el overhead de la reconciliación de React (Virtual DOM diffing) a 60 FPS y previene reflows innecesarios en el contenedor SVG/Canvas de OSMD.

2. **Pre-compilación del Timeline (Drift Mitigation)**:
   Al cargar el MusicXML, se calculan todos los tiempos absolutos en segundos basándose en la posición acumulada de beats. Esto garantiza precisión *sample-accurate* y evita errores acumulativos de redondeo que ocurrirían si se sumaran duraciones relativas en cada paso.

3. **Zero-Allocation en el Hot Path**:
   `TimelineSynchronizer.verify` y el `AudioPipeline` reutilizan objetos compartidos (ej. `SHARED_VERIFICATION_RESULT`, `SHARED_PITCH_FRAME`). En un bucle de audio de 60-100Hz, crear nuevos objetos generaría presión excesiva en el Garbage Collector, provocando micro-cortes (jitter) en el procesamiento de audio.

4. **Filtro Biquad Adaptativo**:
   El `WebAudioAdapter` actualiza dinámicamente la frecuencia central de su filtro pasa-banda según la nota objetivo actual. Esto mejora drásticamente la relación señal/ruido, permitiendo una detección de pitch más robusta incluso en entornos con ruido ambiente.

5. **Estado Observable vs. Alta Frecuencia**:
   El store de Zustand solo almacena hitos musicales discretos (cambio de compás, cambio de nota objetivo). Los datos de alta frecuencia (centésimas, hercios) se consumen de forma imperativa o mediante suscripciones directas en capas de UI especializadas (`FeedbackOverlay`) para mantener el rendimiento del hilo principal.
