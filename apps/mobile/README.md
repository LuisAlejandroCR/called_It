<!-- apps/mobile/README.md: cómo instalar, ejecutar y verificar el prototipo móvil del streamer (Expo /
     React Native), qué se probó de verdad y qué es simulado. Se distingue de ../web/README.md (el panel
     de escritorio) y de ../../MVP.md (la especificación del producto). -->

# Called It — prototipo móvil del streamer

Experiencia móvil, en inglés, para revisar llamadas pendientes, confirmar o rechazar la sugerencia del
oráculo y consultar recibos. **Todos los datos y acciones son simulados.**

Es un proyecto **Expo / React Native** (un solo código para iOS y Android, también ejecutable en web con
react-native-web). **No se compiló ni se probó en iOS ni en Android**: este equipo es Windows, tiene el
SDK de Android pero ningún emulador ni dispositivo, y iOS exige macOS.

## Ejecutar

```bash
cd apps/mobile
npm install
npm start           # menú de Expo: a = Android, i = iOS (solo macOS), w = web
npm run web         # http://localhost:8081, para probar sin emulador
```

Para probarlo en un teléfono real: instala Expo Go y escanea el QR de `npm start`. Para Android en un
emulador: crea un AVD en Android Studio y pulsa `a`. `npm run verify` corre `tsc --noEmit` y las pruebas
de Jest; desde la raíz, `npm run verify:mobile`.

## Qué se probó

| Qué | Cómo | Resultado |
|---|---|---|
| Tipos | `npm run typecheck` | Pasa |
| Reglas de revisión y UNKNOWN | Jest (`src/specs/review.spec.ts`) | Pasa |
| Navegación, flujos y objetivos táctiles ≥ 44 dp | Jest + React Native Testing Library (`src/specs/app.spec.tsx`) | Pasa |
| Interfaz real en el navegador, 390×844 y 320×568, sin desborde horizontal | `npm run web` revisado a mano | Revisado |
| iOS (simulador o dispositivo) | — | **No probado** |
| Android (emulador o dispositivo), botón físico «atrás» y VoiceOver/TalkBack | — | **No probado**: el código usa `BackHandler`, `accessibilityRole/Label/State` y `announceForAccessibility`, pero no se ejercitó con lectores de pantalla reales |

## Pantallas

- **Home:** conteo de llamadas por revisar y tarjetas con vista previa, pregunta, apoyos y «Review call».
- **Review:** vista previa simulada con la zona turquesa, pregunta, apoyos, regla, sugerencia del oráculo con motivo, «Confirm …» y «Reject suggestion». Al confirmar se abre el recibo.
- **Receipts:** lista con filtro (All / Yes / No / Unknown) y detalle con resultado, hora del evento, regla y hash de evidencia.
- **Calls:** todas las llamadas simuladas y en qué estado están.
- Estados: carga, vacío («All caught up»), error del oráculo con reintento y cámara poco clara.

## Reglas del flujo

`UNKNOWN` se confirma como `UNKNOWN` y la llamada queda **canceled**; nunca pasa a `NO`. Rechazar una
sugerencia no elige el veredicto contrario, no crea recibo y deja la llamada sin resultado. Solo una
sugerencia confirmada produce recibo. No se muestra ningún resultado como final antes de confirmarlo.

## Implementado y simulado

| Implementado | Simulado |
|---|---|
| Navegación (pestañas, pila, botón «atrás» de Android), márgenes seguros, objetivos táctiles de 48 dp, roles de accesibilidad | Twitch: sin conexión, sin inicio de sesión |
| Máquina de estados de revisión | Propuestas y apoyos: ids seudónimos, sin nombres |
| Recibos con regla, hora y hash | Vista previa: imagen estática; no se captura ni guarda video |
| | Oráculo: respuestas enlatadas (`src/lib/demo-data.ts`); no analiza imagen. «Will they add salt…» falla una vez para mostrar el error |
| | Confirmación y «reviewed by you»: tu toque; no hay reembolso ni resolución real. El hash de los datos de demo es un ejemplo |
| | Estado solo en memoria: reiniciar la app restaura los datos de demo |

## Código compartido con la web

`src/lib/review.ts`, `demo-data.ts` y `use-review-session.ts` son copias de `../web/src/lib/` (mismas
reglas y mismas pruebas). Hay que mantenerlas sincronizadas hasta extraer un paquete compartido.
`../../src/call.js` (replay) es otro modelo; el desajuste está descrito en `../web/README.md`.

## Pasos pendientes para una app nativa verificada

1. Probar en un emulador o dispositivo Android y en un simulador o dispositivo iOS (macOS), incluidos
   márgenes seguros, teclado y orientación.
2. Revisar con TalkBack y VoiceOver el orden de lectura y los anuncios del oráculo.
3. Sustituir la imagen estática por la fuente de video real cuando exista el backend.
4. Extraer las reglas de revisión a un paquete compartido con la web.
