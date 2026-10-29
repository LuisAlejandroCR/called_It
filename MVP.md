# Especificación del MVP

## Objetivo y alcance

Permitir que el chat proponga una pregunta verificable sobre una zona de un video de cámara fija, que el streamer la apruebe y que el sistema entregue un veredicto con un recibo. El segmento inicial y la necesidad del usuario son hipótesis pendientes de validar. El anclaje AR, los cruces entre canales, las gafas y los rankings quedan fuera del MVP.

## Recorrido

1. Un viewer selecciona una zona del video y propone una pregunta cerrada. Se agrupan coincidencias contando viewers distintos, no toques.
2. El streamer aprueba o rechaza la propuesta. Una propuesta aprobada abre una predicción o una votación propia si Twitch Predictions no está disponible.
3. La cámara observa la zona en el instante relevante. El oráculo produce `YES`, `NO` o `UNKNOWN`, con evidencia y motivo.
4. Al principio el streamer confirma el resultado antes de ejecutar la resolución. `UNKNOWN` cancela la predicción nativa con reembolso; nunca se interpreta como `NO`.
5. El recibo queda en un mural del canal. El mismo recorrido debe poder reproducirse desde un clon limpio sin red ni cuenta de Twitch.

## Responsabilidades y límites

- **Overlay:** captura el toque y lo convierte en coordenadas normalizadas del video. No decide veredictos.
- **Backend de extensión:** autentica al viewer mediante JWT de Twitch, limita y valida solicitudes, cuenta identidades distintas y gestiona propuestas y predicciones. No confía en un veredicto enviado por el cliente.
- **Lente:** obtiene observaciones de la zona en la máquina del streamer. No envía el stream ni guarda frames completos.
- **Oráculo:** aplica primero comprobaciones determinísticas y después, cuando proceda, un verificador de visión. Los umbrales y reglas están en código; evidencia insuficiente produce `UNKNOWN`. Una respuesta tardía se evalúa contra la captura del instante del evento, no contra el frame actual.
- **Mural:** conserva pregunta, zona, instante, hash de evidencia, resultado, regla y confirmación; registra probabilidades solo cuando el verificador realmente las proporciona. No almacena datos personales de viewers.

Un hash y un recibo registran la evidencia y la regla utilizada; no prueban que la escena refleje la realidad ni que la cámara estuviera despejada. Antes de guardar recortes se deben definir consentimiento, acceso y retención, especialmente si aparecen terceros.

## Criterios de aceptación

- Una llamada completa funciona en un stream real y también en reproducción local desde un clon limpio.
- Los votos se cuentan por viewer distinto; solicitudes duplicadas no inflan el conteo.
- Cámara tapada, evidencia ambigua o insuficiente y fallos del verificador producen `UNKNOWN`, sin resolución automática como `NO`.
- La resolución requiere confirmación del streamer hasta que una evaluación independiente justifique automatizarla.
- La reproducción sin red conserva la evidencia, el instante y las reglas necesarias para repetir el resultado.
- La precisión se mide frente a revisión humana con casos reservados antes de ajustar reglas; no se presentan metas como resultados observados.

## Puertas pendientes

Estas preguntas se heredaron del brainstorming y no constituyen pruebas de integración. Registrar fuente primaria, fecha, prueba y fallback para cada una antes de depender de ella:

- Requisitos de elegibilidad, permisos y scopes para crear, resolver y cancelar Twitch Predictions; fallback: votación propia sin puntos del canal.
- Condiciones de Local Test de Twitch Extensions y acceso para una demo o evaluación; fallback: video y reproducción local.
- Canal actual de comunicación del backend al overlay y límites de sus mensajes; fallback: consulta periódica al backend.
- Acceso a cámara desde un browser source de OBS; fallback: lente en navegador separado capturado como ventana.
- Reglamento vigente del evento, uso de código previo, licencia y requisitos de entrega.
- Consentimiento, moderación, retención y manejo de terceros visibles antes de grabar o probar con personas.

## Orden de construcción

1. Registrar las puertas y contratos externos con fuentes y fechas; distinguir documentación de pruebas reales.
2. Modelar estados, evidencia y recibos; implementar un recorrido local reproducible, incluyendo `UNKNOWN`.
3. Añadir propuestas, deduplicación y aprobación del streamer; conectar el mural.
4. Integrar lente y Twitch sobre los contratos verificados, con fallbacks explícitos.
5. Probar con casos reservados y un stream real; documentar ejecución, límites y resultados observados.
