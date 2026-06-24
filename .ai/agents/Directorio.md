## 1. Tu primera acción obligatoria: leer el contexto

Antes de escribir o modificar cualquier código, debes leer los siguientes
archivos en este orden exacto:

1. `.ai/ARCHITECTURE.md` → Capas del sistema, librerías permitidas por capa,
   mandatos de rendimiento (zero-allocation, AudioWorklet,
   reloj maestro). Son reglas no negociables.
2. `.ai/DECISIONS.md` → 4 ADRs activos. Explican POR QUÉ se tomaron
   decisiones clave (AudioWorklet, pitchy/meyda,
   IndexedDB, XState/RxJS). No las reviertas sin
   documentar un nuevo ADR.
3. `.ai/agents/RULES.md` → Guardrails técnicos concretos: prohibición de
   `new`/`{}`/`[]` en el hot-path, noise gate
   obligatorio, sampleRate dinámico.
4. `.ai/agents/ROLES.md` → Los 5 roles de agente definidos. Identifica cuál
   es el tuyo según la tarea asignada.
5. `.ai/tasks/TODO.md` → Backlog maestro con 8 fases. Las tareas marcadas
   con `[x]` están completadas. Las marcadas con
   `[ ]` son trabajo pendiente. Empieza siempre
   por aquí para saber qué hacer.
6. `.ai/logs/CHANGELOG.md` → Historial de cambios. Añade una entrada aquí
   al finalizar cualquier tarea.

## 2. Archivos que DEBES mantener actualizados al terminar

Estos archivos están vacíos y son tu responsabilidad llenarlos:

- `.ai/PROJECT_STATE.md` → Escribe el estado actual del proyecto al terminar
  tu sesión (qué funciona, qué no, qué está a medias).
- `.ai/tasks/IN_PROGRESS.md` → Mueve aquí la tarea en la que estás trabajando.
- `.ai/tasks/DONE.md` → Mueve aquí las tareas completadas con la métrica
  "Líneas de código eliminadas" si aplica.
- `.ai/bugs/OPEN.md` → Registra cualquier bug que encuentres aunque no
  lo vayas a resolver ahora.
- `.ai/knowledge/GOTCHAS.md` → Documenta cualquier comportamiento inesperado
  del código que te haya costado tiempo entender.
- `.ai/experiments/FAILED.md` → Si pruebas un enfoque y no funciona, documéntalo
  ANTES de cambiar de estrategia.
- `.ai/logs/SESSIONS.md` → Resumen de lo que hiciste en esta sesión.

## 3. Protocolo de handoff (`.ai/agents/HANDOFF.md`)

El flujo de trabajo entre agentes es secuencial:
Domain Guardian → DSP Wizard → Signal Tester → Runtime Optimizer

Para declarar un handoff exitoso necesitas:

1. Actualizar `IN_PROGRESS.md` o `DONE.md`.
2. Documentar experimentos fallidos en `FAILED.md`.
3. El código debe compilar con `"strict": true` sin errores.

## 4. Reglas absolutas que nunca puedes romper

- NUNCA uses `new`, `{}`, `[]` dentro del bucle de audio (60 FPS / AudioWorklet).
- NUNCA uses `Date.now()` o `performance.now()` para sincronización musical.
  Usa exclusivamente `AudioContext.currentTime`.
- NUNCA importes código de `lib/persistence/` o adaptadores externos desde
  `lib/domain/`. Todo pasa por `lib/ports/`.
- NUNCA avances a la siguiente librería de modernización (Fase 6) sin que la
  anterior compile y tenga tests pasando.

## 5. Próximas tareas pendientes (según `TODO.md`)

Las tareas `[ ]` sin completar son, por orden de prioridad:

- **2.2** BiquadFilterNode adaptativo + DynamicsCompressorNode
- **2.3** PitchWorker.ts con Transferable Objects + AMDF + Noise Gate
- **3.2** Generador de señales sintéticas de prueba (test de octava del violín)
- **6.3** Pipeline RxJS + XState para NoteSegmenter
- **6.4** simple-statistics + meyda + pitchy
- **6.5** tone.js + consolidación de stores Zustand
- **7.x** TechniqueAgent completo
- **8.x** GlobalStore unificado + persistencia versionada

```

```
