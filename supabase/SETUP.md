# Conectar NEXO a Supabase

1. Crea un proyecto y conserva la contraseña de Postgres fuera del repositorio.
2. Ejecuta `001_nexo.sql` en SQL Editor, una sola vez, en la base nueva. Crea tablas, políticas de acceso y funciones de validación. No contiene datos de ejemplo.
3. En Authentication → URL Configuration usa `https://andresflorez2000.github.io/finanzas-/` como Site URL y como Redirect URL permitida.
4. Habilita el proveedor Email con correo y contraseña. Con confirmación de correo activada, configura SMTP para enviar confirmaciones y recuperaciones a usuarios externos; el servicio de correo de desarrollo de Supabase tiene restricciones.
5. Copia Project URL y la clave pública publishable/anon a `web/config.js`. La clave pública identifica el proyecto y no concede acceso a los datos por sí sola. No uses `service_role`, claves secretas ni la contraseña de Postgres en el código web.
6. Ejecuta `pnpm test` y `pnpm build`. Publica `docs/` desde la rama `main`, como ya está configurado en GitHub Pages.

La página publicada tendrá correo y contraseña, registro, recuperación y salida. No usa ChatGPT ni redirige a Sites. Las sesiones se renuevan con Supabase Auth. El contenido financiero vive en Postgres, protegido por RLS; cada guardado incluye una copia histórica en la misma transacción.

La versión anterior en Sites sigue siendo independiente. No se migra ni elimina su información automáticamente.
