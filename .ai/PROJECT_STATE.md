# PROJECT STATE - Violin Mentor

## Estado Actual
El sistema se encuentra en la Fase 6 de modernización. Se han integrado exitosamente `mnemonist`, `simple-statistics`, `pitchy`, `meyda` y `rxjs`. El pipeline reactivo está operativo pero requiere ajustes de infraestructura para mejorar la precisión en violín.

### Componentes Activos
- **Dominio Musical:** Tipos branded y conversiones de hercios/MIDI/cents operativas.
- **Análisis de Técnica:** `TechniqueAgent` con análisis estadístico en tiempo real (zero-allocation).
- **Pipeline de Audio:** RxJS (`AudioPipeline`) orquestando el flujo desde el micrófono hasta el análisis de técnica.
- **Segmentación de Notas:** Implementada con XState para debouncing de ataques y silencios.
- **Detección de Pitch:** Basada en Web Workers con paso de mensajes por objetos transferibles.

### Próximos Pasos Inmediatos
1.  **Refactorización de Infraestructura**: Adaptar el `AudioManager` para filtros dinámicos.
2.  **Optimización DSP**: Implementar AMDF para evitar errores de octava en el violín.
3.  **Validación**: Ejecutar tests de estrés con señales sintéticas de violín.
4.  **Modernización Final**: Integrar `tone.js` y consolidar el estado global.

### Riesgos e Impedimentos
- Redundancia detectada en la lógica de `NoteSegmenter` (dos máquinas de estado similares).
- Necesidad de asegurar que el `AudioWorklet` o `Worker` maneje correctamente el `Noise Gate` antes de incurrir en costos de procesamiento.
