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

1. **API Imperativa en ScoreViewer**: React no debe saber que el cursor se mueve. El scheduler llama directamente a `scoreRef.current.nextStep()` para evitar el overhead de reconciliación de React a 60 FPS.
2. **Pre-compilación del Timeline**: Al cargar el MusicXML, se calculan todos los tiempos absolutos en segundos. Esto evita errores acumulativos de redondeo que ocurrirían si se sumaran duraciones en cada paso.
3. **Zero-Allocation en Verificación**: `TimelineSynchronizer.verify` reutiliza un objeto `SHARED_VERIFICATION_RESULT`. En un bucle de audio, crear un nuevo objeto `{ isCorrect: true, ... }` 60 veces por segundo generaría presión innecesaria en el Garbage Collector.
4. **Filtro Biquad Adaptativo**: El `WebAudioAdapter` actualiza la frecuencia central de su filtro pasa-banda según la nota que el usuario debe tocar. Esto mejora drásticamente la relación señal/ruido para la detección de pitch.
