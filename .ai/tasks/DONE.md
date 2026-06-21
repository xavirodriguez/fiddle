# AI Project Memory

Ninguna capa de persistencia o servicio de gameplay puede importar código directamente de Web Audio API; todo control de hardware pasa a través de lib/ports/audio.port.ts.

El comando npm run test debe ejecutar el suite de pruebas en menos de 2 segundos de forma totalmente determinista.

El analizador estático de TypeScript debe pasar con cero errores bajo configuraciones de "strict": true.