# Retención y anonimización de datos de pedidos

La versión vigente del aviso de privacidad conserva los datos personales hasta
12 meses después del último pedido del cliente. La migración
`0022_order_data_retention.sql` y el proceso semanal implementan esa regla con
el reloj de PostgreSQL.

## Comportamiento

- Se agrupan los pedidos identificables por teléfono normalizado.
- Un cliente es elegible cuando su pedido más reciente tiene más de 12 meses.
- Se procesan como máximo 250 clientes por ejecución. Las siguientes
  ejecuciones continúan con los grupos restantes.
- Se conservan número, productos, cantidades, precios, estado y fechas.
- Se reemplazan nombre, dirección y teléfono; se eliminan observaciones y la
  clave de idempotencia.
- En `order_edits` se elimina el motivo y ambos snapshots se reemplazan por
  `{ "anonymized": true }`.
- Se conservan la fecha y versión del consentimiento como evidencia sin una
  identidad personal asociada.
- `anonymized_at` registra la acción. Los logs contienen solamente cantidades
  agregadas de clientes, pedidos y ediciones.

El trabajo usa un advisory lock de PostgreSQL para evitar ejecuciones
simultáneas. Repetirlo es seguro porque excluye registros ya anonimizados.

## Excepciones autorizadas

Una obligación legal o contractual se registra en el pedido con
`retention_hold_until` y `retention_hold_reason`. El motivo debe ser un código o
referencia de caso sin datos personales. Use una fecha futura para una retención
temporal o el valor PostgreSQL `infinity` para una retención indefinida.

Mientras cualquier pedido identificable del cliente tenga una retención activa,
se conserva todo su grupo. Cuando la fecha vence, la siguiente ejecución puede
anonimizarlo y limpia ambos campos de excepción. Crear, cambiar o retirar una
retención requiere acceso administrativo a Neon y debe quedar respaldado por el
registro interno que autorizó la excepción.

## Ejecución y verificación

Vercel llama `GET /api/cron/data-retention` cada lunes a las 09:00 UTC. La ruta
exige `Authorization: Bearer <CRON_SECRET>` y falla de forma cerrada si el
secreto no está configurado. Una ejecución manual autorizada puede hacerse así:

```bash
curl --fail-with-body \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://<dominio>/api/cron/data-retention
```

La respuesta y el evento `orders.retention_succeeded` informan solo
`customers`, `orders` y `edits`. Revise semanalmente el cron y sus Runtime Logs;
investigue `orders.retention_failed`, `neon.unavailable` o la ausencia de una
ejecución exitosa.

Antes de desplegar, aplique `0022` en el ambiente correspondiente. La prueba de
integración usa exclusivamente `TEST_DATABASE_URL`, crea datos sintéticos
vencidos, recientes y retenidos, y confirma la anonimización de pedidos y
snapshots.

## Copias de seguridad

La anonimización alcanza la base activa. Los datos pueden persistir hasta que
venza el ciclo de vida de snapshots o copias administradas por Neon. Las copias
solo se usan para recuperación, conservan los mismos controles de acceso y no
deben utilizarse para consultar datos anonimizados. Después de restaurar una
copia, aplique todas las migraciones y ejecute inmediatamente este proceso antes
de reabrir el servicio.
