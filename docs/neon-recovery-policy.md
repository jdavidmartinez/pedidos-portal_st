# Política de copias, restauración y rollback de Neon

Fecha de aprobación: 5 de agosto de 2026.

## Objetivo y alcance

Esta política protege la base PostgreSQL de Portal ST ante eliminación o
corrupción de datos, migraciones defectuosas, errores de aplicación y pérdida
de disponibilidad. Aplica a producción, desarrollo y testing; ninguna prueba
de recuperación se ejecuta directamente sobre producción.

Objetivos operativos para producción:

| Objetivo | Meta |
| --- | --- |
| RPO, pérdida máxima aceptable | 15 minutos para incidentes dentro de la ventana de restauración |
| RTO, tiempo máximo de recuperación | 30 minutos para incidentes de aplicación o datos |
| Ventana de restauración instantánea | Máximo permitido por el plan; mínimo recomendado de 7 días |
| Simulacro de restauración | Trimestral y después de cambios destructivos importantes |
| Revisión de esta política | Semestral o cuando cambie el plan de Neon |

La meta de RPO depende de detectar el incidente dentro de la ventana realmente
configurada. El responsable debe verificarla en Neon después de cualquier
cambio de plan; no se debe asumir el valor predeterminado.

## Capas de protección

### 1. Restauración instantánea de Neon

En **Neon > Project Settings > Restore window**, configura el máximo que admita
el plan. Neon conserva el historial de cambios y permite consultar o restaurar
un punto dentro de esa ventana. Antes de restaurar producción se debe usar Time
Travel Assist o una rama creada desde el punto elegido para validar los datos.

### 2. Snapshots o copia lógica

Si el plan ofrece snapshots programados, configura:

- snapshot diario con retención de 14 días;
- snapshot semanal con retención de 8 semanas;
- snapshot manual antes de una migración destructiva.

Si el plan no ofrece snapshots programados, realiza semanalmente una copia
lógica en formato custom:

```bash
pg_dump --format=custom --no-owner --no-acl "$DATABASE_URL" \
  --file portal-pedidos-AAAA-MM-DD.dump
```

La copia contiene datos personales. Debe cifrarse, almacenarse fuera del
repositorio en un espacio privado con acceso limitado y eliminarse al terminar
su retención. Nunca debe guardarse en Git, Google Drive público, Slack o un
equipo compartido sin cifrado.

Una copia no se considera válida hasta restaurarla en una base temporal y
completar el verificador incluido en el proyecto.

### 3. Migraciones versionadas

Los archivos aplicados de `db/migrations` son inmutables. El proyecto usa
migraciones hacia adelante y no mantiene scripts `down` automáticos.

- Nunca edites una migración que ya figure en `schema_migrations`.
- Nunca borres manualmente una fila de `schema_migrations` para simular un
  rollback.
- Prefiere cambios aditivos y compatibles con la versión anterior.
- Para revertir lógica o esquema, crea una nueva migración compensatoria.
- Separar cambios destructivos en tres despliegues: expandir, migrar datos y
  retirar la estructura antigua cuando ya no exista código dependiente.

## Procedimiento antes de migrar producción

1. Confirma que CI, pruebas API y build estén verdes.
2. Ejecuta la migración primero contra `TEST_DATABASE_URL`.
3. Identifica y registra la hora UTC anterior a la migración.
4. Crea un snapshot manual si el plan lo permite; de lo contrario confirma que
   esa hora esté dentro de la ventana de restauración.
5. Verifica que el despliegue anterior de Vercel continúe disponible para
   rollback.
6. Ejecuta `npm run db:migrate` una sola vez contra producción.
7. Revisa `/menu`, crea un pedido controlado y abre `/cocina` y `/admin`.
8. Supervisa errores `5xx` y eventos `neon.unavailable` durante 30 minutos.

## Decisión de rollback

| Situación | Acción principal |
| --- | --- |
| Error de código sin cambio incompatible de esquema | Rollback del deployment en Vercel; no restaurar la base. |
| Migración aditiva con error corregible | Desplegar una migración compensatoria hacia adelante. |
| Eliminación/corrupción de datos | Detener escrituras y restaurar Neon al punto validado. |
| Migración incompatible con el código anterior | Detener escrituras; restaurar código y base como una sola operación coordinada. |
| Neon no disponible | No ejecutar migraciones; revisar el estado del proveedor y conservar evidencia. |

Restaurar la base es una acción excepcional: revierte todas las escrituras
posteriores al punto elegido, incluidas órdenes legítimas.

## Restauración de emergencia

1. Declara el incidente y registra hora de inicio, despliegue y última orden
   conocida como correcta.
2. Evita nuevas escrituras. Si es necesario, promueve temporalmente una versión
   de mantenimiento o desactiva el flujo de envío de pedidos.
3. En Neon abre **Backup & Restore** y usa Time Travel Assist para localizar el
   último punto correcto con consultas de conteo, nunca mostrando información
   personal en canales compartidos.
4. Restaura primero a una rama nueva o usa el flujo de restauración en varios
   pasos. Conserva la rama anterior hasta terminar la validación.
5. Configura localmente la URL temporal:

```dotenv
RECOVERY_DATABASE_URL=postgresql://...
```

6. Ejecuta la validación de solo lectura:

```bash
npm run db:verify-recovery
```

7. Ejecuta `npm run test:api` únicamente si la base seleccionada es una copia
   desechable; esas pruebas escriben y eliminan datos.
8. Promueve/finaliza la restauración siguiendo el flujo de Neon. Confirma la
   cadena de conexión efectiva en Vercel y vuelve a desplegar si cambió.
9. Ejecuta el smoke test, confirma la última orden y vigila observabilidad.
10. Conserva temporalmente el estado previo hasta cerrar el incidente; después
    elimínalo de acuerdo con los costos y la política de retención.

## Restauración desde `pg_dump`

Solo se usa cuando el punto requerido está fuera de la ventana instantánea o
para verificar la copia de largo plazo. Crea una base Neon temporal vacía:

```bash
pg_restore --no-owner --no-acl --clean --if-exists \
  --dbname "$RECOVERY_DATABASE_URL" portal-pedidos-AAAA-MM-DD.dump
npm run db:verify-recovery
```

`--clean` es destructivo para la base indicada. Debe usarse exclusivamente con
una URL temporal validada, nunca con `DATABASE_URL` de producción.

## Simulacro trimestral

El registro del simulacro debe incluir:

- fecha, responsable y punto temporal seleccionado;
- método usado: historial, snapshot o `pg_dump`;
- duración hasta base disponible y hasta servicio validado;
- resultado de `npm run db:verify-recovery`;
- RPO y RTO observados;
- problemas encontrados y acciones correctivas;
- confirmación de eliminación de archivos y ramas temporales.

## Responsabilidades

- **Administrador técnico:** configura la ventana, ejecuta copias y simulacros.
- **Responsable del restaurante:** confirma la última orden válida y el impacto
  operativo.
- **Quien despliega:** registra migración, hora UTC, commit y resultado del
  smoke test.

Referencias oficiales:

- https://neon.com/docs/manage/projects#configure-instant-restore
- https://neon.com/docs/guides/branching-intro
- https://neon.com/docs/introduction/branch-restore
- https://www.postgresql.org/docs/current/backup-dump.html
