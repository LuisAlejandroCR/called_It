<!-- BRAINSTORM.md: la idea elegida para el Codex x TwitchCon Hackathon —la mezcla de las cinco ideas
     iniciales—, su hoja del problema, arquitectura por responsabilidades, fases (AR en la fase 2),
     plan de diez días, guion del video y puertas por verificar. Se distingue de
     README.md (la portada). -->

# Called It — chat lo predice, la cámara lo decide

> **Chat calls it. The camera settles it. Every call leaves a receipt.**

Nombre de trabajo. El texto de pantalla va en inglés, porque el público y el jurado son de TwitchCon.
La documentación privada va en español.

## 0. Los eventos

Fuente: la ficha de Devpost que pegó el operador, leída el 2026-10-23. El reglamento completo todavía
no se leyó: lo que depende de él va `⏳`.

| | Codex x TwitchCon | Learn AR with SPECS |
|---|---|---|
| Cierre | **2026-11-02, 17:00 EST** (17:00 hora Bogotá) | 2026-11-09, 17:00 EST |
| Premios | USD 25.000; el top 5 sale en el escenario de TwitchCon el 2026-11-15 | USD 2.500 |
| Inscritos al leerlo | 20 | 623 |
| Entregable | Repo + video ≤ 3 min en YouTube + descripción + **session ID de Codex** | Repo público + video ≤ 3 min + carpeta `devpost/` |
| Condición dura | Conectar con Twitch y estar construido con Codex | Proyecto nuevo, planeado con el skill pack y construido con CLAD en Lens Studio |
| Jurado | Idea, impacto, implementación (incluye el uso de Codex), diseño | Diseño, implementación, idea, presentación |

**Arquetipo, en una línea:** sprint online abierto; el jurado ve un video de 3 minutos y *puede*
probar el repo. Por eso el video es el entregable y el clon limpio tiene que correr sin cuenta de
Twitch. Si hay código previo permitido: `⏳` hasta leer las reglas.

## 1. La hoja del problema

Aplica `03_Garden/strategic-problem-solving.md`, en versión corta.

| Campo | Contenido |
|---|---|
| Problema central | El chat de Twitch participa con texto sobre lo que pasa en la pantalla, pero no tiene forma de **señalar** el mundo del streamer ni de que la realidad le dé la razón |
| Causa (5 porqués, resumido) | Las Predictions las cierra el streamer a mano → cierra tarde o se olvida → nadie confía en el resultado → en los streams IRL, de ciencia, de cocina o de tabletop no se usan |
| Persona 1: streamer | Tiene las manos ocupadas (cocina, juega, camina). Quiere que el chat juegue sin tener que moderar el juego ⏳ supuesto |
| Persona 2: viewer | Quiere tener razón en público y que se note ⏳ supuesto |
| Objetivo SMART | En 1 stream de prueba de ≥ 30 min, antes del 2026-10-31: ≥ 5 llamadas creadas desde un toque del chat, y en cada una el veredicto de la cámara coincide con la revisión humana o cae en `UNKNOWN` (nunca un `NO` falso) |

## 2. De las cinco ideas a una sola

| Idea inicial | Qué aporta a la mezcla | Cuándo |
|---|---|---|
| 2 · Oráculo de Predictions | **El núcleo.** La cámara decide, con recibo | MVP |
| 1 · Chat toca la realidad | El chat **propone la zona** de la llamada tocando el video. Es 2D, con cámara fija | MVP (toque) · fase 2 (anclaje AR) |
| 4 · El cuarto recuerda | Cada llamada resuelta deja su recibo en un **mural del canal** que dura entre streams | MVP (versión mínima) |
| 3 · Portal entre streams | El chat de un canal predice sobre la realidad de otro | Fase 3 |
| 5 · HUD de gafas | El streamer ve las llamadas del chat en el mundo, con manos libres | Spin-off para SPECS, con código propio |

**El ciclo, en una frase:** un viewer toca el video → los viewers distintos que coinciden proponen una
zona y una pregunta → el streamer aprueba con un toque → se abre la predicción → la cámara observa
la zona → el código decide `YES`, `NO` o `UNKNOWN` → el recibo queda en el mural.

```text
toque del viewer ──► propuesta (zona + pregunta) ──► streamer aprueba ──► predicción abierta
                                                                            │
mural del canal ◄── recibo ◄── veredicto (YES / NO / UNKNOWN) ◄── oráculo observa la zona
```

## 3. Arquitectura por responsabilidades

Una línea por superficie, según `technical_pitch.md`.

| Superficie | Responsabilidad | Nunca hace |
|---|---|---|
| **Overlay** (Twitch Extension de video, en el viewer) | Captura el toque y lo normaliza a coordenadas del video (0–1) | Mandar un veredicto |
| **EBS** (backend de la extensión) | Verifica el JWT de Twitch, cuenta viewers distintos, crea y cierra la predicción por Helix | Confiar en un campo del cliente que no sea el toque |
| **Lente** (browser source en OBS, en la máquina del streamer) | Recorta la zona y extrae **observaciones** del frame | Mandar el stream ni guardar frames completos |
| **Oráculo** | Corre la escalera de verificadores y decide con umbrales que viven en el código | Decidir con una sola señal o adivinar un `NO` |
| **Mural** | Guarda los recibos: pregunta, zona, instante, hash del frame, probabilidades, regla que se disparó y quién confirmó | Guardar datos personales de los viewers |

## 4. El oráculo — escalera, estados y recibo

Aplica `agent_loops.md`, `jev.md` y `ring_api.md`.

1. **Escalón determinístico:** diff de píxeles y movimiento dentro de la zona. Si no cambió nada, el modelo ni se llama.
2. **Escalón de modelo:** preguntas cerradas sobre el recorte (`¿el objeto X está dentro de la zona?`), que devuelven una probabilidad y nunca prosa. El modelo y la forma de sacar la probabilidad se deciden el día 5, midiendo ⏳.
3. **El código decide:** con `p ≥ alto` → `YES`; con `p ≤ bajo` → `NO`; en medio → `UNKNOWN`. Los valores de los umbrales viven en la configuración, nunca en un doc público.
4. **El nivel de acción se gana:** arranca en *propone y el streamer confirma*. Pasa a *resuelve solo* únicamente si la precisión medida en el stream de prueba lo justifica.
5. **`UNKNOWN` cancela con reembolso.** Nunca se cuela como `NO`. El frame que se evalúa es el del instante del evento, no el del momento en que responde el modelo.

**El recibo dice qué prueba y qué no:** prueba que el sistema vio esa zona en ese instante y que
aplicó esa regla. **No** prueba que el mundo fuera así ni que la cámara no estuviera tapada.

**Modo `record / replay`** (`ORACLE_MODE`): la demo y el jurado corren sobre llamadas grabadas, sin
red ni cuenta de Twitch.

## 5. Fases

| Fase | Qué entra | Criterio de terminado |
|---|---|---|
| **MVP** (antes del 2026-11-02) | Toque → propuesta → aprobación → predicción → oráculo → recibo → mural. Cámara fija, zonas 2D | Una llamada completa en un stream real, y la misma en `replay` desde un clon limpio |
| **Fase 2 — AR** | La zona queda **anclada al objeto**: homografía sobre un plano y, después, cámara en movimiento; oclusión por segmentación | El error de anclaje medido contra puntos que no entraron en el ajuste |
| **Fase 3 — Portal** | Llamadas entre canales: el chat de A predice sobre la realidad de B durante un raid | Dos canales, una llamada cruzada resuelta |
| **Spin-off — SPECS** | Lente para gafas: el streamer IRL ve en el mundo la zona y el veredicto, con manos libres | Las reglas de SPECS: skill pack, CLAD, preview de Lens Studio |

## 6. Plan de diez días

Del 2026-10-23 al 2026-11-02, ordenado del bloque más fácil al más difícil.

| Días | Bloque | Terminado cuando |
|---|---|---|
| 23–24 oct | Puertas (sección 8), hoja del problema, `AGENTS.md`, contratos de Helix, EventSub y Extensions con fuente y fecha, hilo de Codex abierto | Un bot lee el chat y abre una predicción en el canal propio: la ruta real de punta a punta, el día 1 |
| 25–26 oct | Overlay + EBS: toque → propuesta → conteo de viewers distintos → aprobación del streamer | Dos cuentas de prueba tocan la misma zona y el contador dice 2, no "2 toques" |
| 27–28 oct | Oráculo: escalera, umbrales en código, `UNKNOWN`, `record / replay` | Con la red apagada, `replay` decide las llamadas grabadas igual que en vivo |
| 29–30 oct | Stream de prueba de ≥ 30 min, con casos reservados que el ciclo nunca vio; recibo y mural | Se mide la precisión del oráculo contra la revisión humana y se decide el nivel de acción |
| 31 oct–2 nov | Diseño, video de 3 min, README, permalinks, clon limpio, envío **antes de las 15:00** | Formulario enviado con el session ID; queda margen de 2 h |

El 29 de octubre a las 12:00 ET es la sesión en vivo de SPECS: se ve grabada, sin robarle horas al MVP.

## 7. Cómo se usa Codex (lo que puntúa)

1. **Un hilo principal** para el build: su session ID va en el envío. Las tareas paralelas en la nube son 4 como máximo (`agent_loops.md`).
2. **`AGENTS.md`** como contrato del repo, que Codex lee de forma nativa: reglas, `npm run verify` y lo que nunca se toca.
3. **Cada ciclo con la plantilla `/GOAL`:** terminas cuando, verifica con, PARA si, tope. El verificador no lo edita el agente.
4. **Codex escribe los contratos desde la documentación viva**, y un test los fija. Las APIs inventadas se cazan antes del envío (`sponsor_track_rules.md`).
5. **20 segundos del video** muestran Codex dentro del ciclo: el prompt, el rojo y el verde.

## 8. Puertas por verificar el día 1

Ninguna se da por hecha (`sponsor-gate-check`).

1. **¿La API de Predictions exige que el canal sea afiliado o partner?** ⏳ Si el canal propio no califica, el plan B son llamadas propias en el overlay, sin puntos del canal.
2. **¿Una Extension en Local Test sirve para la demo y para el jurado, sin la revisión de Twitch?** ⏳
3. **¿Cómo se envía hoy un mensaje del EBS al overlay** (Helix "Send Extension PubSub Message" u otra vía)? ⏳
4. **Reglamento completo:** código previo, el modelo de runtime (¿puntúa usar OpenAI en vivo?) y la licencia ⏳.
5. **Privacidad IRL:** si en la zona aparece un tercero, ¿se recorta o se difumina? Se decide antes de grabar ⏳.

## 9. Guion del video (≤ 3:00)

```text
0:00–0:15  Promesa: "Chat calls it. The camera settles it." Un stream de cocina real.
0:15–1:15  El ciclo: toque → propuesta → aprobación → la cámara decide → recibo en el mural.
1:15–1:45  La falla: la cámara se tapa → UNKNOWN → se cancela y se reembolsa. Nunca un NO falso.
1:45–2:15  Codex: el hilo, AGENTS.md, un ciclo con verificador de rojo a verde.
2:15–2:45  Fase 2: el mismo pin anclado al objeto (AR), mostrado como el destino y no como algo hecho.
2:45–3:00  Cierre: qué quedó demostrado hoy y qué falta validar.
```

## 10. Fuera de alcance, a propósito

| Fuera | Por qué |
|---|---|
| AR en el MVP | Seguir objetos con la cámara en movimiento no cabe en 10 días con un verificador honesto |
| Dados, encuestas y chat genérico | El jurado pidió no reconstruir los ejemplos |
| Guardar el stream o frames completos | Minimización: alcanzan el hash y el recorte de la zona |
| Rankings con nombres de viewers | Exigen que el viewer comparta su identidad; el mural usa ids opacos |
| Decidir sin recibo | Un veredicto sin evidencia anclada es `UNKNOWN` |
