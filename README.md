# NEXO · GitHub Pages + Supabase

Versión con registro por correo y contraseña y datos privados en Supabase. No requiere ChatGPT.

Esta rama está preparada, pero todavía falta crear el proyecto de Supabase, ejecutar supabase/001_nexo.sql y configurar web/config.js. No publicar en main hasta verificar la conexión.

Sigue supabase/SETUP.md. Solo la URL y la clave pública publishable/anon se incluyen en la aplicación; nunca subas contraseñas ni claves secretas.

Comandos con Node.js 24 y pnpm: pnpm install, pnpm test, pnpm build y pnpm dev. La compilación genera docs/, la carpeta que publica GitHub Pages. El SDK se incluye en la compilación sin depender de un CDN.

Cada usuario tiene su propio histórico, protegido con RLS. Cada guardado valida los datos y crea una copia histórica en la misma transacción. Se conservan cuentas, presupuestos, ingresos, gastos, metas, filtros y descargas JSON.

Juan y Diana son perfiles dentro del espacio de cada usuario; no son cuentas de acceso independientes. Se admiten pesos colombianos enteros, hasta 10.000 movimientos, 500 registros por otra categoría y 2 MB por estado.

Los archivos del servidor de Sites y las migraciones D1 se conservan como referencia. No forman parte del resultado de GitHub Pages. No se migra ni elimina la información de Sites automáticamente.