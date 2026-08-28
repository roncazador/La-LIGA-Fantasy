# La-LIGA Fantasy — estado compacto

Fecha: 28/08/2026
Rama: `main`

## Estado v2.13
La aplicación visible está consolidada en un único controlador oficial: `calendar-client.js`. Los clientes heredados `dashboard-client.js` y `connection-client.js` son shims pasivos y no hacen consultas duplicadas.

## Interfaz
Se ocultan las capas antiguas y se presenta una única interfaz grande, táctil y ligera con seis apartados: **Inicio**, **Cerebro**, **Equipo**, **Partidos**, **Mercado** y **Liga**.
Los botones principales tienen un área de toque amplia y el calendario aparece también en Inicio para que no vuelva a quedar oculto detrás de una pestaña.

## Calendario
La UI activa usa exclusivamente **LALIGA oficial**.
- Los nombres de API-Football, football-data.org, Sportmonks y Opta no aparecen en el calendario activo.
- El calendario público parte de `official-fixtures-seed-2026-27.json`.
- Con sesión oficial, se consulta `/api/fantasy/fixtures?week=...` para intentar recuperar calendario y estado/resultado oficial.
- Cuando el endpoint autenticado no responde, se utiliza únicamente la semilla oficial verificada.
- Los partidos se deduplican por fecha + local + visitante.

## Resultados en directo
El normalizador interpreta estados de juego como `1H`, `2H`, `HT`, `LIVE`, `FT`, etc., y busca marcadores en varias formas de payload para mostrarlos en la tarjeta del partido sin inventar resultados. La UI refresca cada 30 s si detecta un partido en directo y cada 5 min en caso contrario.

## Cerebro
El cerebro del controlador recibe plantilla, mercado y calendario desde el mismo estado. Calcula score, confianza, disponibilidad, contexto del próximo partido, mercado y riesgo.

## Caché móvil
El service worker se ha versionado a `fm-v213` para forzar la sustitución del recurso anterior y evitar que iPhone/Edge reutilice la UI antigua.

## Seguridad
No se exponen claves, tokens, cookies ni credenciales. La app sigue en modo solo lectura.

## Pruebas
`npm test` ejecuta `qa.test.mjs` y `qa-100000.test.mjs`.
La suite profunda realiza **100.000 micro-pasos** deterministas y cada 10 pasos abre un bloque de verificación con 10 comprobaciones adicionales. Se verifican especialmente normalización, deduplicación, fuente única oficial, estados LIVE, marcadores, ausencia de datos inventados, versión, UI, shims pasivos y caché móvil.

El workflow principal de Project tests había terminado correctamente en la versión anterior del mismo cambio; tras las últimas correcciones se han vuelto a lanzar las suites sobre el commit actual y deben considerarse definitivas cuando finalicen.

## Regla para futuras mejoras
Mantener una sola interfaz activa, una sola fuente de calendario, un solo estado compartido y un único controlador de refresco. No volver a añadir controladores paralelos ni fuentes duplicadas. Cada actualización debe conservar el gate de 100.000 micro-pasos y el control por bloques de 10.