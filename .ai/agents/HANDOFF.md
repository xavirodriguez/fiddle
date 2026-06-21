# AI Project Memory
# Protocolo de Handoff (Ciclo de Desarrollo)

Para mantener la coherencia del estado del proyecto en `.ai/PROJECT_STATE.md`, los agentes interactúan bajo el siguiente flujo secuencial:

[1. Domain Guardian] ──► Diseña las estructuras y tipos de datos musicales.
│
▼
[2. DSP Wizard] ────────► Implementa los algoritmos matemáticos y Puertos de Audio.
│
▼
[3. Signal Tester] ─────► Inyecta ondas de prueba y valida la precisión técnica.
│
▼
[4. Runtime Optimizer] ──► Orquesta los hilos, remueve la latencia y une el Service.


### Requisitos obligatorios para declarar un "Handoff" exitoso:
1. El agente saliente debe actualizar la tarea correspondiente en `.ai/tasks/DONE.md` o `IN_PROGRESS.md`.
2. Si un experimento falla (por ejemplo, si la autocorrelación simple no es lo suficientemente precisa para las frecuencias altas del violín), se debe documentar el motivo exacto en `.ai/experiments/FAILED.md` antes de ceder el turno al siguiente enfoque.
3. El código modificado debe compilar bajo el flag estricto de TypeScript sin advertencias