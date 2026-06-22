# AI Project Memory

# 📋 Backlog Maestro de Desarrollo: Sistema de Detección de Pitch de Ultra-Baja Latencia

## 🌌 Fase 1: Fundaciones del Dominio y Tipado Estricto

**Objetivo:** Crear el núcleo matemático e inmutable del negocio musical libre de dependencias externas.
**Asignado a:** `Domain Guardian`

* [x] **1.1. Modelado de Tipos Nominales (TypeScript Branding) en `lib/domain/musical-domain.ts**`
* [x] **1.2. Sistema de Ajuste de Afinación Base (A4 Calibration)**
* [x] **1.3. Abstracciones de Análisis Microtonal en `lib/domain/data-structures.ts**`

---

## 🔊 Fase 2: Infraestructura de Audio y Pipeline DSP (Entrada de Hardware)

**Objetivo:** Capturar la señal cruda, aislar los armónicos y procesarla en un hilo secundario sin latencia.
**Asignado a:** `DSP Wizard`

* [x] **2.1. Definición de Contratos en `lib/ports/audio.port.ts**`
* [ ] **2.2. Implementación del Grafo de Nodos Web Audio API**
* [ ] **2.3. Creación del Web Worker Concurrente (`PitchWorker.ts`)**

---

## 🧪 Fase 3: Automatización y QA de Señal Matemática

**Objetivo:** Asegurar mediante pruebas con datos sintéticos que el motor detecta notas reales antes de tocar instrumentos en vivo.
**Asignado a:** `Signal Tester`

* [x] **3.1. Implementación de Pruebas Unitarias Estrictas en `lib/domain/data-structures.test.ts**`
* [ ] **3.2. Generador de Señales Sintéticas de Prueba**

---

## 🎼 Fase 4: Motor de Sincronización de Partituras y Acompañamiento

**Objetivo:** Resolver el desacoplamiento entre el renderizado de la partitura y el motor de audio determinista.
**Asignado a:** `Interactive Systems Engineer`

* [x] **4.1. El Puente de Audio (`lib/audio/tone-bridge.ts`)**
    * [x] Unificar `AudioContext` nativo con `Tone.js`.
    * [x] Definir tipos nominales para `Seconds` y `BPM`.

* [x] **4.2. Visor de Partitura de Alto Rendimiento (`components/practice/ScoreViewer.tsx`)**
    * [x] Encapsular `OpenSheetMusicDisplay` (OSMD) con renderizado puramente en el cliente.
    * [x] Implementar `useImperativeHandle` para control de cursor libre de re-renders de React.

* [x] **4.3. Orquestador de Línea de Tiempo Determinista (`lib/practice/timeline-synchronizer.ts`)**
    * [x] Pre-calcular el mapa de eventos musicales en segundos absolutos.
    * [x] Implementar el scheduler de `Tone.Transport` para disparar callbacks en tiempo real.
    * [x] Añadir verificación de precisión de pitch con asignación de memoria cero.

* [x] **4.4. Sincronización Reactiva de UI (`stores/practice-sync-store.ts`)**
    * [x] Implementar store de Zustand con Immer para feedback inmediato de afinación y progreso de compás.

---

## 💾 Fase 5: Persistencia de Sesión y Calibración Histórica

**Objetivo:** Almacenar de forma segura el perfil físico de afinación del usuario y sus estadísticas de práctica.
**Asignado a:** `Infrastructure Engineer`

* [x] **5.1. Definición de Esquemas en `lib/persistence/storage-types.ts**`
* [x] **5.2. Implementación del Núcleo de Almacenamiento en `lib/persistence/persistence-core.ts**`

---

## 🛠️ Fase 6: Modernización y Sustitución por Librerías Especializadas

**Objetivo:** Reducir deuda técnica y aumentar la robustez mediante la integración de estándares de la industria.
**Asignado a:** `Systems Architect`

* [x] **6.1. Refactorización de Estructuras de Datos (Domain)**
* [x] **6.2. Integración de Manejo Funcional de Errores e Inmutabilidad (Application)**
* [ ] **6.3. Pipeline Reactivo y Máquinas de Estado (Application/Infrastructure)**
* [ ] **6.4. Análisis Estadístico y Extracción de Features (Domain/Infrastructure)**
* [ ] **6.5. Motor de Audio y Persistencia Reactiva (Infrastructure/Adapters)**

---

## 🧠 Fase 7: Análisis de Técnica y Agentes de IA Musical

**Objetivo:** Proporcionar feedback inteligente al usuario mediante el análisis avanzado de señales y heurísticas musicales.
**Asignado a:** `AI & Signal Specialist`

* [ ] **7.1. Agente de Análisis de Técnica (Domain)**
* [ ] **7.2. Extracción de Timbre (Infrastructure)**
* [ ] **7.3. Generador de Heurísticas de Feedback (Application)**

---

## 📈 Fase 8: Ecosistema de Estado y Persistencia Evolucionada

**Objetivo:** Centralizar la gestión del estado y garantizar una persistencia robusta y escalable.
**Asignado a:** `Fullstack Architect`

* [ ] **8.1. Consolidación del Almacenamiento de Estado (Adapters)**
* [ ] **8.2. Adaptador de Persistencia de Alta Disponibilidad (Infrastructure)**
* [ ] **8.3. Visualización de Progreso y Analíticas (Application/Adapters)**
