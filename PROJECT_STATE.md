# La-LIGA Fantasy — estado compacto

Fecha: 28/08/2026
Rama: `main`

## Objetivo actual
Manager Fantasy en modo **solo lectura**, optimizado para móvil/iPhone, que combina datos LIVE cuando hay sesión con una referencia visual de la app oficial cuando no la hay.

## Estado v2.12
La interfaz principal está consolidada en un único controlador `dashboard-client.js`, con seis apartados grandes: **Resumen**, **Cerebro**, **Equipo**, **Partidos**, **Mercado** y **Liga**.
El antiguo `calendar-client.js` queda como puente compatible para evitar dos controladores de calendario funcionando a la vez.

## Calendario
El cliente usa `/api/fixtures`, que ya entrega el resultado multi-proveedor deduplicado en `merged`. También acepta `matches` y la semilla oficial `fixtures` para tolerancia con respuestas antiguas. Cuando los proveedores externos no responden, se utiliza `official-fixtures-seed-2026-27.json` como respaldo explícitamente marcado y nunca como LIVE.

## Cerebro v2.12
El cerebro recibe plantilla, mercado y calendario desde el mismo estado de aplicación. Calcula rendimiento, disponibilidad, contexto del próximo partido, señal de mercado, riesgo y confianza. La confianza baja cuando faltan campos; no se inventan datos.

## Conexión LIVE
`/api/fantasy/dashboard` es la fuente autenticada para perfil, liga, clasificación, plantilla, presupuesto y mercado. Los cambios LIVE se publican con `laliga:live-data`, y el controlador unificado vuelve a analizar los datos para que interfaz y cerebro no trabajen con copias diferentes.

## Interfaz
Se ocultan los paneles heredados y se mantiene una navegación táctil simple, con una sola vista grande por apartado y menos elementos simultáneos en pantalla.

## Seguridad
Nunca poner claves API, tokens, cookies o credenciales en frontend o JSON público.
No activar compras, ventas, pujas ni modificaciones de plantilla.

## Pruebas
`npm test` ejecuta `qa-10000.test.mjs` con **10.000 casos deterministas** que recorren normalización de partidos, respuesta `merged`, semilla de calendario, extracción de plantilla/mercado, scoring y confianza del cerebro, integración LIVE, contratos de interfaz y rutas públicas/privadas.

## Nota para futuras iteraciones
No rehacer arquitectura ni añadir capas de diagnóstico innecesarias. Primero corregir errores de CI, duplicidades y datos; después ampliar el cerebro Fantasy sobre la base v2.12.