# Called It

> **Chat calls it. The camera settles it. Every call leaves a receipt.**

Called It es un proyecto para el Codex x TwitchCon Hackathon: los viewers proponen una pregunta sobre una zona del video, el streamer la aprueba y un oráculo observa la escena para producir un veredicto con recibo. La interfaz de la demo será en inglés.

El repositorio está en fase de preparación: **todavía no hay código ni una integración verificada**. La primera entrega será un recorrido completo con cámara fija y un modo de reproducción local sin cuenta de Twitch.

## Documentación

- [Especificación del MVP](MVP.md): flujo, responsabilidades, criterios de aceptación y decisiones pendientes.
- [Prototipo web del streamer](apps/web/README.md): panel de revisión simulado (`npm run verify:web`); explica qué es simulado.
- [Prototipo móvil del streamer](apps/mobile/README.md): app Expo / React Native simulada (`npm run verify:mobile`); no probada en iOS ni Android.
- [Skills del proyecto](.agents/skills/README.md): referencias para Twitch, Codex y visión en tiempo real.

## Primeros pasos de desarrollo

1. Confirmar las puertas de Twitch y del evento descritas en la especificación, registrando fuentes y resultados de pruebas.
2. Definir los contratos y construir primero una llamada completa en modo local reproducible.
3. Integrar Twitch y la cámara, conservando la confirmación del streamer y el tratamiento explícito de `UNKNOWN`.
4. Validar el recorrido real y documentar cómo ejecutarlo desde un clon limpio.

## Ejecutar el primer ciclo local

Requiere Node.js 20 o posterior; no hay dependencias externas. Ejecuta `npm run verify` para correr las pruebas y reproducir los ejemplos, o `npm run replay` para ver los recibos. También se puede ejecutar `node src/replay.js ruta/al/archivo.json` con el formato de [fixtures/demo.json](fixtures/demo.json).

El replay usa observaciones sintéticas registradas: todavía no conecta cámara, Twitch, interfaz ni almacenamiento persistente. Los umbrales de 0,1 y 0,9 son provisionales y no están calibrados; los resultados no demuestran precisión en video real. La confirmación y las identidades son simuladas en este primer ciclo.
