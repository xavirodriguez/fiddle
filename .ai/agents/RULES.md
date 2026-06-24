# AI Project Memory

# Reglas Críticas del Proyecto (Project Guardrails)

## 1. Reglas de Arquitectura e Inyección de Dependencias
- **Desacoplamiento Estricto:** La lógica de dominio (`lib/domain/`) NO puede importar nada de `lib/persistence/` ni de adaptadores externos. Todo debe fluir a través de interfaces definidas en `lib/ports/`.
- **Pureza del Dominio:** Las funciones en `musical-domain.ts` deben ser puras (mismo input, mismo output) para facilitar el testeo matemático.

## 2. Reglas del Bucle Crítico (Hot Path Execution)
- **Zero Memory Allocation a 60FPS:** Dentro del bucle de animación o del callback del procesador de audio, está ESTRICTAMENTE PROHIBIDO el uso de palabras clave `new`, inicialización de objetos `{}`, o arrays literales `[]`. Toda la memoria (como `Float32Array`) debe ser pre-alojada durante la inicialización.
- **Concurrencia Aislada:** El análisis de Pitch mediante algoritmos pesados debe delegarse a un hilo secundario (Web Worker). No se permite bloquear el hilo principal de la interfaz de usuario.

## 3. Reglas Técnicas de Audio (Violín y Voz)
- **Frecuencia de Muestreo Adaptativa:** No asumas nunca que el micrófono corre a 44100Hz o 48000Hz. El código debe consultar dinámicamente `audioContext.sampleRate`.
- **Puerta de Ruido Obligatoria:** Antes de calcular el pitch, se debe evaluar la energía RMS de la señal. Si está por debajo de un umbral configurable (Noise Gate), el resultado debe ser inmediatamente cortado como silencioso (`pitch: -1`) para evitar lecturas caóticas del ruido ambiental.

## 4. Reglas de Integración y Calidad
- **Aislamiento de API de Audio:** Ninguna capa de persistencia o servicio de gameplay puede importar código directamente de Web Audio API; todo control de hardware pasa a través de `lib/ports/audio.port.ts`.
- **Rendimiento de Tests:** El comando `npm run test` debe ejecutar el suite de pruebas en menos de 2 segundos de forma totalmente determinista.
- **Calidad de Tipado:** El analizador estático de TypeScript debe pasar con cero errores bajo configuraciones de `"strict": true`.