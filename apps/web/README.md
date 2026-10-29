<!-- apps/web/README.md: cómo instalar, ejecutar y verificar el prototipo web del streamer (panel de
     revisión de llamadas), y qué partes son simuladas. Se distingue de ../../README.md (la portada del
     repositorio) y de ../../MVP.md (la especificación del producto). -->

# Called It — prototipo web del streamer

Panel responsivo, en inglés, para que el streamer revise propuestas del chat, confirme o rechace la
sugerencia del oráculo y vea el muro de recibos. **Es un prototipo: todo lo que muestra es simulado.**

Pila: Vite + React 19 + TypeScript + Tailwind CSS 4, solo cliente (sin servidor), Node 20 o posterior y
npm, igual que el resto del repositorio. Se migró desde `../lovable-web` (TanStack Start + bun +
Nitro) quitando el servidor, el reporte de errores de Lovable, las fuentes de Google y las ~45
primitivas de UI que no se usaban.

## Ejecutar

```bash
cd apps/web
npm install
npm run dev        # http://localhost:5173
```

`npm run verify` corre `tsc --noEmit`, las pruebas (vitest) y el build. Desde la raíz, `npm run verify:web`
hace lo mismo y `npm run verify` sigue verificando solo el replay.

## Qué es simulado

| Parte | Realidad en el prototipo |
|---|---|
| Twitch | No hay conexión, inicio de sesión ni datos de canal |
| Propuestas y apoyos | Datos de demo con ids seudónimos; nunca nombres de viewers |
| Vista previa de cámara | Una imagen estática. No se captura ni se guarda video |
| Oráculo | Sugerencias enlatadas con motivo (`src/lib/demo-data.ts`); no analiza imagen. «Will they add salt…» falla una vez para mostrar el estado de error |
| Confirmación | Tu clic hace de confirmación del streamer. No se reembolsa ni se resuelve nada en Twitch |
| Estado | Solo en memoria: recargar la página restaura los datos de demo |

## Reglas del flujo (`src/lib/review.ts`, probadas)

- `UNKNOWN` es incertidumbre: confirmarlo lo deja como `UNKNOWN` y la llamada queda **canceled**; nunca pasa a `NO`.
- Rechazar una sugerencia no elige el veredicto contrario ni crea recibo.
- Solo una sugerencia confirmada produce un recibo (pregunta, hora del evento, regla, zona y hash de evidencia si existe).
- Rechazar una propuesta no crea recibo.

## Pantallas

`#/` Dashboard (llamadas pendientes con apoyos distintos, vista previa con zona marcada, panel de revisión,
recibos recientes) · `#/calls` · `#/receipts` · `#/settings` (qué es simulado y «Restore demo data»).
Estados cubiertos: carga, vacío («All caught up»), error del oráculo con reintento y cámara poco clara.

## Desajuste con el código de replay

`../../src/call.js` (replay en Node, estados `proposed → open → awaiting_confirmation → resolved|canceled`) y
`src/lib/review.ts` son modelos separados: el replay no tiene rechazo de propuesta ni de sugerencia, y
guarda `zone` en fracciones 0–1 y el hash completo en SHA-256, mientras el prototipo usa porcentajes y
hashes de ejemplo abreviados. No se reutilizó el replay para no inventar una integración; el prototipo
queda con datos de demo etiquetados. Unificar los contratos es trabajo pendiente.
