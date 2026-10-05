# Recuperar contraseña

Rama: `feature/password-recovery`. Proveedor: API HTTPS de Resend desde Vercel.

Aplicar `0025_password_recovery.sql` primero en development y testing.
Configurar `RESEND_API_KEY`, `PASSWORD_RESET_FROM` y `APP_ORIGIN` en cada ambiente.
`APP_ORIGIN` debe ser el origen HTTPS exacto del despliegue; local admite
`http://localhost:3000`. No se construyen enlaces con el header Host del cliente.

La dirección inicial autorizada es `jdavid.martinez@gmail.com`. Falta confirmar
el usuario al que corresponde. No asignar ese correo a todas las cuentas ni
reenviar a él enlaces de usuarios distintos. Una vez confirmado, asociarlo en
Neon con una consulta parametrizada, solo a ese usuario. Los demás usuarios sin
`recovery_email` conservan el restablecimiento por administrador.

Usar `onboarding@resend.dev` para pruebas con el correo de la cuenta Resend.
Para otros destinatarios, verificar un dominio y configurar su remitente.
Documentación: https://resend.com/docs/api-reference/emails/send-email

El formulario público devuelve la misma respuesta para cuentas inexistentes,
inactivas y fallos de envío. Revisar logs `password_recovery.request_failed`
si el correo no llega. Los tokens aleatorios de 256 bits se guardan únicamente
como SHA-256, vencen en 15 minutos y se consumen atómicamente. Restablecer la
contraseña invalida los otros enlaces y todas las sesiones. Los cambios de
contraseña existentes también invalidan los enlaces pendientes.
El enlace usa un fragmento URL y la página lo elimina de la barra al cargar.
Las solicitudes tienen límites persistentes en Neon y cuerpos limitados.

Antes de producción, verificar en una cuenta de prueba: recepción real,
contraseña nueva, rechazo de token reutilizado/vencido, revocación de sesiones,
correo desconocido/inactivo y límites de envío. Ejecutar lint, typecheck,
unit tests y build. Luego aplicar la migración en Production, configurar
variables de Production y desplegar el commit probado.
