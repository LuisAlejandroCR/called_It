# Preparación de JEV

`src/jev/oracle.js` define una frontera experimental para clasificar **observaciones textuales** de un productor confiable. No captura ni interpreta imágenes y no está conectado a las aplicaciones. El clasificador es inyectado; las pruebas usan respuestas sintéticas, no grabaciones reales de JEV.

La evaluación conserva el instante del evento y el hash de evidencia. Sin visibilidad, cambio, hash, fecha con zona, umbrales explícitos o respuesta válida devuelve `UNKNOWN`. La confirmación humana sigue siendo necesaria en la integración futura. Los umbrales de las pruebas son ejemplos, no están calibrados.

Antes de habilitar servicio real: verificar el esquema y modelo vigente de TypeSafe con documentación primaria, implementar transporte exclusivamente en servidor con credenciales fuera del cliente, definir límites de tiempo y tratamiento de datos, identificar un productor de observaciones y evaluar un conjunto reservado. Nunca aceptar observaciones o veredictos arbitrarios del viewer como evidencia confiable. Definir grabación y reproducción sin secretos ni datos sensibles; aún no están implementadas.

Las notas locales de investigación describen JEV como modelo de texto; no se ha verificado que pueda evaluar directamente video o imágenes en esta integración. Una clasificación de observaciones tampoco demuestra que la observación corresponda a la escena.
