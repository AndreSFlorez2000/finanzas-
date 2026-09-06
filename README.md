# NEXO · GitHub Pages + Supabase

NEXO funciona directamente en https://andresflorez2000.github.io/finanzas-/ con correo y contraseña. No requiere ChatGPT.

La base de datos Supabase está creada y conectada. El registro requiere confirmación de correo. Antes de admitir usuarios externos, configura SMTP: el servicio de correo integrado está limitado a miembros de la organización. La recuperación de contraseñas también depende de ese servicio.

Cada usuario tiene su propio histórico, protegido con RLS. Cada guardado valida los datos y conserva una copia histórica en la misma transacción. Se mantienen cuentas, presupuestos, ingresos, gastos, metas, filtros y descargas JSON.

Juan y Diana son perfiles dentro del espacio de cada usuario; no son cuentas de acceso independientes. Se admiten pesos colombianos enteros, hasta 10.000 movimientos, 500 registros por otra categoría y 2 MB por estado.

## Desarrollo

Con Node.js 24 y pnpm: pnpm install, pnpm test, pnpm build y pnpm dev. La compilación genera docs/, la carpeta que publica GitHub Pages. El SDK se incluye en la compilación sin depender de un CDN. Después de cambiar el código, compila y guarda también los archivos generados de docs/.

En web/config.js solo se incluye la URL del proyecto y su clave pública publishable. Nunca subas contraseñas ni claves secretas. El esquema está en supabase/001_nexo.sql; ya fue aplicado en el proyecto conectado. Las políticas restringen todas las consultas al usuario autenticado.

## Versión anterior

Los archivos de Sites y las migraciones D1 se conservan como referencia. No forman parte del resultado de GitHub Pages. La información de Sites no se migra ni elimina automáticamente.