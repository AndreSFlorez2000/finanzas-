# NEXO · Finanzas en pareja

[Abrir NEXO](https://nexo-finanzas-andres.chummy-mink-2332.chatgpt.site)

NEXO permite administrar las cuentas y presupuestos de Juan y Diana, sus movimientos y las metas de ahorro conjunto. Empieza vacío, sin datos de ejemplo.

## Dónde se guarda cada cosa

- GitHub conserva el código y sus cambios desde la versión original V7.
- El sitio se aloja en Sites. La base de datos privada Cloudflare D1 conserva los movimientos, las cuentas, los presupuestos y las metas; los datos financieros nunca se suben al repositorio.
- Cada guardado crea una versión histórica en la base de datos. «Versiones» permite descargar las últimas 100; las anteriores siguen almacenadas. «Descargar respaldo» exporta el estado actual como JSON.
- Si otra pestaña guarda primero, se rechaza el cambio desactualizado. Pulsa «Actualizar» antes de repetirlo.

## Acceso

La publicación inicial es privada y solo permite la cuenta propietaria de Sites. Inicia sesión con la misma cuenta de ChatGPT con la que se creó el sitio. Las pestañas Juan y Diana organizan datos dentro de esa cuenta; no son usuarios independientes ni restringen la vista entre sí. No se ha habilitado acceso compartido.

## Primer uso

1. En Juan o Diana, crea una cuenta con su saldo inicial.
2. Crea un presupuesto si lo necesitas y registra ingresos o gastos.
3. En Nosotros, crea una meta y registra los aportes desde las cuentas.
4. Espera el aviso «Guardado en la nube» antes de cerrar la página.

## Desarrollo y publicación

Requiere Node.js 24 y pnpm.

```sh
pnpm install
pnpm test
pnpm build
pnpm dev
```

La vista local usa una base SQLite temporal: sus datos se descartan al detener el servidor. Los datos publicados permanecen en D1. Las migraciones están en `drizzle/`; se generan con `pnpm db:generate`. El servidor requiere el encabezado de identidad que suministra la pasarela autenticada de Sites. No debe exponerse directamente detrás de un proxy que acepte ese encabezado del visitante.

Las finanzas se guardan como un documento validado, con revisión y copias históricas, en tablas D1. La actualización y la copia se confirman juntas en una transacción. El límite actual es 10.000 movimientos y 2 MB por estado. Se usan pesos colombianos enteros. Esta versión no importa ni restaura respaldos automáticamente.

GitHub Pages puede mostrar una página de entrada, pero no ejecuta este servidor ni la base de datos. Un cambio en GitHub conserva una nueva versión del código; para actualizar el sitio hay que compilar y publicar una nueva versión en Sites. No hay despliegue automático configurado.
