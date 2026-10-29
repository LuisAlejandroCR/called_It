---
name: realtime-vision
description: >
  Decidir algo sobre video en vivo (webcam, cámara de stream, overlay) con un costo y una honestidad
  medibles: la escalera de verificadores aplicada a frames (diff de píxeles → detector en el
  navegador → modelo de visión → persona), observaciones en vez de píxeles, el instante del evento
  como fuente de verdad, YES/NO/UNKNOWN, y el AR de pantalla (anclar una zona a un objeto) como fase
  aparte. Usar cuando el usuario dice "visión en tiempo real", "cámara", "webcam", "overlay que ve",
  "detectar en el stream", "MediaPipe", "OpenCV.js", "AR simulado", "anclar al objeto", "oráculo".
---

<!-- realtime-vision.md: semilla — la forma de una decisión automática sobre video en vivo, sacada de
     reglas ya aprendidas con una cámara fija y todavía sin un proyecto que la pruebe de punta a
     punta. Se distingue de 00_Files/ring_api.md (una cámara concreta y su API) y de
     00_Files/agent_loops.md (la escalera de verificadores en general): aquí va el video en vivo. -->

# Visión en tiempo real — mirar es barato; decidir hay que ganárselo

Una semilla. Junta reglas que ya costaron algo en [ring_api.md](https://github.com/LuisAlejandroCR/procedures/blob/main/00_Files/ring_api.md), en
[agent_loops.md](https://github.com/LuisAlejandroCR/procedures/blob/main/00_Files/agent_loops.md) y en las lecciones de `knowledge/`, aplicadas a una
decisión sobre video en vivo. Todavía no hay un proyecto que la haya corrido de punta a punta.

## La escalera, aplicada a frames

| Escalón | Qué hace | Costo |
|---|---|---|
| 1 · Diff de píxeles en la zona | ¿Cambió algo dentro del recorte? Si no, nadie más trabaja | Casi gratis, en el navegador |
| 2 · Detector local | Objetos, manos o segmentación en el navegador (`@mediapipe/tasks-vision@1.1.1`, revisado en npm el 2026-10-23) | Milisegundos por frame |
| 3 · Modelo de visión | Preguntas cerradas sobre el recorte, una propiedad por pregunta | Una llamada de red por decisión |
| 4 · Persona | La zona de duda entre los dos umbrales | Un toque |

El modelo nunca decide solo: lo acompaña al menos un escalón determinístico.

## Cinco reglas que ya se pagaron

1. **Por el cable viajan observaciones, no píxeles** (dispositivo, instante, tipo, confianza, caja). Se guarda el hash del frame y el recorte, nunca el stream ([ring_api.md](https://github.com/LuisAlejandroCR/procedures/blob/main/00_Files/ring_api.md), [security_privacy.md](https://github.com/LuisAlejandroCR/procedures/blob/main/00_Files/security_privacy.md)).
2. **El instante del evento es la verdad.** Se evalúa el frame de ese instante, no el del momento en que responde el modelo (`knowledge/_drafts/judge-at-delivery-time.md`).
3. **Sin evidencia, `UNKNOWN`. Nunca un `NO`.** La cámara tapada, la luz que cambió o el objeto fuera del recorte no son evidencia en contra (`knowledge/what-a-false-reads-as.md`, `knowledge/degraded-vs-failed.md`).
4. **El nivel de acción se gana midiendo.** Primero proponer y que una persona confirme; actuar solo con la precisión medida en casos reservados (`knowledge/_drafts/actuation-must-be-earned.md`).
5. **Los umbrales viven en el código, y el motivo es la regla que se disparó** más las probabilidades que la dispararon ([jev.md](https://github.com/LuisAlejandroCR/procedures/blob/main/03_Garden/jev.md)).

## AR de pantalla — una fase aparte

Anclar una zona a un objeto que se mueve es otro problema que detectar algo en una zona fija.

1. **Primero, un plano con cámara fija:** una homografía sobre la mesa o el tablero.
2. **El error se mide con puntos que no entraron en el ajuste.** El residuo del propio ajuste da casi cero y no prueba nada (`knowledge/_drafts/own-fit-residual-proves-nothing.md`).
3. **Cuando el anclaje se pierde, la zona vuelve a quedar fija en pantalla**, con un estado visible. Nunca desaparece en silencio.
4. **La oclusión** (el cuerpo tapando la zona) **se resuelve con segmentación**, y mientras dura cuenta como `UNKNOWN`.

## Abierto — por verificar

| Pregunta | Estado |
|---|---|
| ¿Un browser source de OBS puede abrir la webcam? Foros de la era OBS 26 dicen que exige `--enable-media-stream` en el lanzamiento | ⏳ |
| ¿Qué API de modelo de visión da una probabilidad calibrada por pregunta cerrada (logprobs, un clasificador, Jev sobre observaciones)? | ⏳ |
| ¿Cuánto tarda en degradar cada escalón, y no solo si degrada? (`knowledge/degraded-path-has-its-own-latency.md`) | ⏳ |

## Para pasar a brote

Correrla en un proyecto con cámara fija y casos reservados. Anotar la precisión medida contra la
revisión humana y qué umbral habilitó cada nivel de acción.

## Verify

1. Con la zona sin cambios, el modelo no se llamó ni una vez: PASS/FAIL.
2. Con la cámara tapada, el veredicto es `UNKNOWN`, nunca `NO`: PASS/FAIL.
3. El frame evaluado tiene la marca de tiempo del evento, no la de la respuesta: PASS/FAIL.
4. Nada del stream completo se guarda; solo hashes y recortes con TTL: SÍ/NO.
5. El error de anclaje AR se midió con puntos fuera del ajuste: SÍ/NO.
