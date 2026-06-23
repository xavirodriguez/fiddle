# PROJECT STATE - Violin Mentor

## Estado Actual
El sistema cuenta con una base sólida de dominio musical con tipado estricto y una infraestructura de audio inicial. Se ha implementado un motor de sincronización musical y persistencia básica.

### Componentes Activos
- **Dominio Musical:** Tipos branded para Hertz, Cents, MidiNote. Conversores precisos.
- **Infraestructura de Audio:** `WebAudioAdapter` con `AudioWorklet` para captura. `PitchDetector` envolviendo `pitchy`.
- **Sincronización:** `TimelineSynchronizer` para seguimiento de partituras.
- **Persistencia:** Core asíncrono con Zod schemas.

### Por Hacer (Próximos Pasos)
- Implementar `AudioPipeline` con RxJS para desacoplar la captura del procesamiento.
- Implementar `NoteSegmenter` con XState para una transición robusta entre silencio y nota.
- Integrar `simple-statistics`, `meyda` y `tone.js`.

### Riesgos Identificados
- El hot-path de 60FPS debe mantenerse libre de alocaciones.
- La latencia de audio en dispositivos móviles.
