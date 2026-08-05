# Observabilidad y alertas de producción

Fecha de implementación: 5 de agosto de 2026.

## Cobertura

La aplicación combina la telemetría nativa de Vercel con eventos estructurados
propios. La cobertura incluye:

- respuestas `5xx` visibles en Vercel Functions y Runtime Logs;
- errores no capturados por medio de `instrumentation.ts` de Next.js;
- fallos de conexión o configuración de Neon;
- carga, inventario y limpieza de Vercel Blob;
- creación y consulta de pedidos;
- disponibilidad de Gemini;
- ejecución programada de la limpieza de imágenes.

Los eventos de error contienen nombre del evento, operación, dependencia,
estado HTTP, ambiente, despliegue y request ID cuando está disponible. No se
registran cuerpos de solicitudes, nombres, direcciones, teléfonos, contraseñas,
tokens, cadenas de conexión ni mensajes internos de las excepciones.

## Eventos principales

| Evento | Significado |
| --- | --- |
| `orders.create_succeeded` | La orden se creó o se reconoció como duplicada. |
| `orders.create_failed` | La creación de una orden terminó en `500`. |
| `neon.unavailable` | Neon no está configurado o no se encuentra disponible. |
| `blob.upload_failed` | Falló una carga hacia Vercel Blob. |
| `blob.inventory_failed` | Falló el inventario de imágenes. |
| `blob.cleanup_failed` | Falló la limpieza manual o programada. |
| `gemini.request_failed` | La solicitud al asistente falló. |
| `server.unhandled_error` | Next.js capturó un error no controlado. |

## Activar alertas por webhook

> Estado pendiente: el código está desplegado, pero las notificaciones externas
> no quedarán activas hasta configurar y probar `OBSERVABILITY_WEBHOOK_URL` en
> Vercel Production.

1. Crea un webhook HTTPS en Slack, en el sistema de incidentes elegido o en un
   receptor propio.
2. En Vercel abre el proyecto y entra a **Settings > Environment Variables**.
3. Crea `OBSERVABILITY_WEBHOOK_URL` para **Production** con la URL completa.
4. Si el receptor requiere `Authorization: Bearer`, crea
   `OBSERVABILITY_WEBHOOK_TOKEN` con el secreto correspondiente.
5. Vuelve a desplegar `master` para que las funciones reciban las variables.

Cada error envía un objeto con `text` y `event`. Los eventos iguales se limitan
a uno cada cinco minutos por instancia para reducir notificaciones repetidas.
Un fallo del webhook nunca cambia la respuesta entregada al cliente.

Las alertas de anomalías de Vercel pueden habilitarse adicionalmente desde
**Observability > Alerts > Subscribe to Alerts** cuando el plan tenga
Observability Plus. Esta capa detecta aumentos anormales de respuestas `5xx` y
puede notificar por email, Slack o webhook.

## Consultar e investigar

En el dashboard de Vercel abre **Logs** y busca por cualquiera de estos valores:

```text
"level":"error"
"event":"orders.create_failed"
"dependency":"neon"
"dependency":"blob"
```

Desde una terminal vinculada al proyecto:

```bash
npx vercel logs --environment production --status-code 5xx --since 1h
npx vercel logs --environment production --query 'orders.create_failed' --since 1h
```

Para correlacionar el incidente, compara `requestId`, `deployment`, `operation`
y la hora. No copies datos personales desde las órdenes hacia tickets o canales
de soporte.

## Respuesta recomendada

1. Confirma si afecta una sola ruta o varias.
2. Revisa el último despliegue y el estado de Neon, Blob o Gemini según el campo
   `dependency`.
3. Si fallan pedidos, valida `/api/menu` y realiza un pedido de prueba sin datos
   personales reales.
4. Si el incidente comenzó con un despliegue, aplica rollback en Vercel y
   conserva los logs para el análisis.
5. Registra hora de inicio, impacto, causa, corrección y hora de recuperación.

Referencias oficiales:

- https://vercel.com/docs/observability
- https://vercel.com/docs/functions/logs
- https://vercel.com/docs/alerts
- https://nextjs.org/docs/app/guides/instrumentation
