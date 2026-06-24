# AI Project Memory - SESSIONS

## [2026-06-21] - Modernización: Pipeline RxJS y NoteSegmenter XState

**Agente:** Jules (Modernización)

### Resumen de la Sesión
- Limpieza de metadatos del proyecto: relocalización de reglas a `RULES.md` y actualización de `DONE.md`.
- Implementación de `NoteSegmenter` utilizando XState para evitar jitter en la detección de notas.
- Implementación de `AudioPipeline` utilizando RxJS para orquestar el flujo de audio de forma reactiva y eficiente.
- Refactorización de `PracticeService` para integrar el nuevo pipeline, eliminando el bucle manual de `requestAnimationFrame`.
- Optimización de rendimiento: se garantizó el cumplimiento de la regla "Zero-Allocation" mediante la reutilización de objetos de evento XState y el singleton `SHARED_PITCH_FRAME`.
- Corrección de regresión en el suavizado de frecuencia detectada en el code review.

### Archivos Modificados
- `.ai/agents/RULES.md`
- `.ai/tasks/DONE.md`
- `.ai/tasks/TODO.md`
- `.ai/tasks/IN_PROGRESS.md`
- `.ai/PROJECT_STATE.md`
- `lib/practice/note-segmenter.ts`
- `lib/audio/audio-pipeline.ts`
- `lib/practice/practice-service.ts`
- `lib/practice/note-segmenter.test.ts`
- `lib/audio/audio-pipeline.test.ts`

### Métricas
- **Líneas de código manual eliminadas:** ~150 (en `PracticeService` y lógica de segmentación anterior).
- **Tests nuevos:** 7 (100% pass).
- **Alocaciones en Hot Path:** 0 (verificado por inspección).
