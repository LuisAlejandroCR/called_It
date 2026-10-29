---
name: twitch
description: >
  Construir sobre Twitch: Helix, EventSub (webhook, WebSocket, conduit), chat por EventSub con la
  API de enviar mensajes, Predictions y Polls, y Extensions (overlay de video, JWT del EBS, PubSub de
  extensión, Local Test / Hosted Test). Incluye la Twitch CLI para mockear API y eventos sin canal
  real, y las puertas que se abren el día uno. Usar cuando el usuario dice "Twitch", "Helix",
  "EventSub", "chatbot de Twitch", "Twitch Extension", "overlay", "EBS", "predictions", "polls",
  "channel points", "twitch-cli", "mock-api", o construye algo para streamers y su chat.
---

<!-- twitch.md: el mapa de las superficies de Twitch que usa un producto para streamers —qué token y
     qué scope pide cada una, qué se puede mockear y qué puerta hay que abrir el día uno—. Se
     distingue de hackathon_tools.md (el procedimiento genérico para conectar un tercero) y de
     public_api_hardening.md (endurecer las rutas sin login, como el EBS): aquí solo va Twitch. -->

# Twitch — cuatro superficies, cuatro tokens distintos

Un producto para streamers casi siempre toca cuatro superficies, y cada una pide un token distinto.
Confundirlas es el error del día uno: un `403 subscription missing proper authorization` con el token
equivocado parece un bug del código.

Verificado el 2026-10-23 contra código: la Twitch CLI (`twitchdev/twitch-cli@fd7dac6`), el
hello-world oficial de Extensions (`twitchdev/extensions-hello-world@78bc797`, de 2020) y
`@twurple/ebs-helper@8.2.0`. `dev.twitch.tv` no fue alcanzable desde el entorno de trabajo: lo que
viene solo de búsqueda va marcado **[Búsqueda]** y se relee en la documentación antes de construir.

## Las cuatro superficies

| Superficie | Para qué | Token | Scope o requisito |
|---|---|---|---|
| **Helix** (`https://api.twitch.tv/helix/...`) | Leer y escribir: predicciones, encuestas, canal, chat saliente | User access token del broadcaster (o app token donde baste) + `Client-Id` | Por endpoint, p. ej. `channel:manage:predictions` |
| **EventSub** | Recibir eventos: chat, predicciones, follows, raids | Webhook o conduit: app token. WebSocket: user token | El del tipo de evento |
| **Chat** | Leer por EventSub `channel.chat.message`; escribir por `POST /helix/chat/messages` | Ver tabla de abajo | `user:read:chat`, `user:write:chat`, `user:bot`, `channel:bot` **[Búsqueda]** |
| **Extensions** | UI dentro del player (overlay de video, panel, componente) + su backend (EBS) | JWT firmado con el secreto de la extensión | Rol `external` desde el EBS |

## Chat — el bot es un usuario

**[Búsqueda]**, guía oficial del chatbot y foro de desarrolladores:

| Caso | Tokens |
|---|---|
| Bot instalado (corre con el streamer) | Un user token del broadcaster con `user:bot`, `user:read:chat`, `user:write:chat` |
| Bot en la nube, muchos canales | App token + user token de la cuenta del bot (`user:bot`) + `channel:bot` del broadcaster **o** el bot como moderador |

El `400` al suscribir `channel.chat.message` solo con `broadcaster_user_id` se arregla agregando el
`user_id` del bot a la condición.

## Predictions — la puerta antes del código

| Dato | Valor | Fuente |
|---|---|---|
| Crear | `POST /helix/predictions`, scope `channel:manage:predictions` | mock de la CLI |
| Título | 1–45 caracteres | mock de la CLI |
| Resultados | 2–10 | mock de la CLI |
| `prediction_window` | Hasta 1800 s. El mock acepta desde 1; la documentación dice 30 **[Búsqueda]** | mock + búsqueda |
| Terminar | `PATCH` con `status` = `RESOLVED` (exige `winning_outcome_id`), `CANCELED` o `LOCKED` | mock de la CLI |
| Eventos | `channel.prediction.begin` · `progress` · `lock` · `end` | CLI |
| **Quién puede** | **Solo canales Affiliate o Partner con Channel Points activos** | **[Búsqueda]**, la documentación de Twitch |

`CANCELED` devuelve los puntos: es la salida honesta cuando no hay evidencia para decidir. Si el canal
de prueba no es Affiliate, el plan B se escribe el día uno (votación propia en la extensión o en el
chat, sin puntos), no la noche antes.

## Extensions — el player es de Twitch, el EBS es tuyo

1. **El front recibe un JWT** en `window.Twitch.ext.onAuthorized` y lo manda al EBS en `Authorization: Bearer`.
2. **El EBS verifica** con el secreto de la extensión **decodificado de base64**, algoritmo `HS256`. Del payload salen `channel_id`, `opaque_user_id` y `role`. Un secreto sin decodificar da `403 JWT could not be verified` **[Búsqueda]**.
3. **El EBS habla al front** con `POST /helix/extensions/pubsub`, cuerpo `{ target, broadcaster_id, message }`, firmado con un JWT propio: `role: "external"`, `user_id` del dueño de la extensión, `channel_id` y `pubsub_perms.send` igual a los targets, con expiración corta (el helper usa 60 s). Los targets son `broadcast`, `global` o `whisper-<user_id>`. El mensaje tiene un tope de 5120 caracteres **[Búsqueda]**. El hello-world de 2020 usa la ruta vieja `extensions/message/{channel}`: no copiarla.
4. **Un `204` es aceptación, no entrega.** Se confirma que el mensaje llegó con el front abierto **[Búsqueda]**.
5. **`opaque_user_id` no es la persona.** Distingue viewers sin identificarlos. El `user_id` real solo llega si el viewer comparte su identidad, y nada del producto debe depender de que lo haga.

### Ciclo de vida

| Estado | Assets | Quién la ve |
|---|---|---|
| **Local Test** | Tu servidor HTTPS (certificado propio), en la base URI de prueba | El dueño y las cuentas de prueba |
| **Hosted Test** | Subidos al CDN de Twitch | Igual. Para volver a editar hay que regresar a Local Test |
| **Released** | CDN, tras la revisión de Twitch | Todos |

**[Búsqueda]**: los cambios en la lista de cuentas de prueba solo aplican al cambiar de estado. En
Local Test, la configuración de la consola (CSP y demás) no se aplica: la replica tu servidor.

## Probar sin canal real — la Twitch CLI

| Comando | Qué da |
|---|---|
| `twitch mock-api generate -c 10` | Usuarios, client id y secret falsos con sus relaciones |
| `twitch mock-api start` | Un Helix falso local (incluye predictions y polls) con su OAuth de juguete; los tokens viven 24 h |
| `twitch event trigger prediction-begin -F https://localhost:8080/` | Un evento EventSub falso hacia tu webhook |
| `twitch event websocket start-server` | Un servidor EventSub por WebSocket local |
| `twitch event verify-subscription <evento> -F <url>` | Comprueba que tu webhook responde el reto de verificación |

El mock **valida la forma** de lo que mandas (título, número de resultados, estados): sirve como
verificador determinístico en un ciclo de agente, antes de tocar un canal real.

## Webhooks de EventSub

La firma es HMAC-SHA256 sobre `message_id + timestamp + cuerpo crudo`, verificada antes de parsear
([public_api_hardening.md](https://github.com/LuisAlejandroCR/procedures/blob/main/00_Files/public_api_hardening.md)). Existe una skill de terceros,
`hookdeck/webhook-skills` → `twitch-webhooks` (`npx skills add hookdeck/webhook-skills --skill
twitch-webhooks`), sin revisar: leerla antes de instalarla.

## Reglas

1. **Abrir las puertas el día uno:** Affiliate para Predictions, la app registrada, los scopes de cada token y la extensión en Local Test.
2. **Un token por superficie, escrito en el contrato** con su scope y quién lo emite. Nunca reutilizar el del streamer para el bot.
3. **Ningún veredicto lo manda el viewer.** El front manda gestos; el EBS decide ([public_api_hardening.md](https://github.com/LuisAlejandroCR/procedures/blob/main/00_Files/public_api_hardening.md)).
4. **Contar viewers con `opaque_user_id` distintos**, nunca toques ni mensajes.
5. **El mock de la CLI es el primer verificador.** El canal real va después.

## Para promoverla a perenne

1. Usarla en un proyecto real y releer en `dev.twitch.tv` todo lo marcado **[Búsqueda]**.
2. Anotar con su costo concreto cada regla que cambió una decisión.
3. Quitar lo que no se usó.

## Verify

```bash
twitch mock-api start &                                   # Helix local
curl -s -X POST localhost:8080/mock/predictions -H "Authorization: Bearer $TOKEN" \
  -H "Client-Id: $CLIENT_ID" -H "Content-Type: application/json" \
  -d '{"broadcaster_id":"'$BID'","title":"x","outcomes":[{"title":"a"}],"prediction_window":60}'
# esperado: 400, porque hay un solo resultado
```

1. Con una sola opción, el mock responde `400`; con dos, `200`: PASS/FAIL.
2. El EBS rechaza un JWT firmado con el secreto **sin** decodificar de base64: PASS/FAIL.
3. Un `twitch event trigger prediction-end` llega al webhook y se verifica la firma antes de parsear: PASS/FAIL.
4. El canal de prueba es Affiliate o Partner, o el plan B está escrito: SÍ/NO.
5. Lo marcado **[Búsqueda]** se releyó en `dev.twitch.tv`: SÍ/NO.
