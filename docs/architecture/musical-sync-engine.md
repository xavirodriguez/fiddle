# Motor de Sincronización Musical en Tiempo Real

Este documento describe la arquitectura y el flujo de datos del sistema de sincronización musical implementado.

## 1. Fuente de Verdad Temporal Única

El sistema utiliza un único `AudioContext` nativo compartido entre el motor DSP y Tone.js.

- **ToneBridge**: Sincroniza Tone.js con el contexto de la aplicación.
- **Sin Drift**: Al compartir el mismo reloj de hardware, se eliminan las desincronizaciones entre el acompañamiento y el análisis de micrófono.
- **Sample-accurate**: El scheduling se realiza directamente en el transport de Tone.js, garantizando precisión de milisegundos.

## 2. Flujo de Datos

```text
[ Micrófono ] -> [ WebAudioAdapter ] -> [ AudioPipeline (RxJS) ]
                       |                         |
                       v                         v
               [ AudioContext ] <------- [ ToneBridge ]
                       |                         |
                       v                         v
               [ Tone.Transport ] ----> [ Musical Scheduler ]
                       |                         |
                       v                         v
               [ ScoreViewer API ] <--- [ PracticeService ]
                       |                         |
                       v                         v
               [ Renderizado OSMD ]      [ Zustand Store ]
```

## 3. Flujo Temporal (Scheduling)

```text
Tiempo (s)  0.0       0.5       1.0       1.5
            |---------|---------|---------|
Timeline    [Nota 1]  [Nota 2]  [Nota 3]  ...
Transport   Trigger @ 0.5s -> ScoreViewer.nextStep()
Mic Input   Detección @ 0.52s -> TimelineSynchronizer.verify(0.52, midi)
Resultado:  isCorrectPitch: true, timingError: 0.02s
```

## 4. Dependencias entre Módulos

```text
[ UI Components ]
      |
      v
[ PracticeService (Orquestador) ]
      |
      +--> [ ToneBridge ]
      +--> [ TimelineSynchronizer ]
      +--> [ ScoreViewer (API Imperativa) ]
      +--> [ AudioPipeline ]
      +--> [ Zustand Store ]
```

## 5. Decisiones de Rendimiento

- **Zero-Allocation**: Uso de objetos mutables compartidos (`SHARED_PITCH_FRAME`, `SHARED_VERIFICATION_RESULT`) en el hot-path (60 FPS).
- **API Imperativa**: `ScoreViewer` evita el ciclo de render de React para mover el cursor, eliminando costos de reconciliación y reflow innecesarios.
- **O(1) Verification**: `TimelineSynchronizer` utiliza un puntero incremental para verificar la precisión temporal de forma instantánea.
