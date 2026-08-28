# La-LIGA Fantasy — estado compacto

Fecha: 28/08/2026
Rama: `main`

## Estado v2.13
La aplicación visible está consolidada en un único controlador oficial: `calendar-client.js`. Los clientes heredados `dashboard-client.js` y `connection-client.js` son shims pasivos y no hacen consultas duplicadas.

## Interfaz
Se ocultan las capas antiguas y se presenta una única interfaz grande, táctil y ligera con seis apartados: **Inicio**, **Cerebro**, **Equipo**, **Partidos**, **Mercado** y **Liga**.
Los botones principales tienen un área de toque amplia y el calendario también aparece en Inicio para que no vuelva a quedar oculto detrás de una pestaña.

## Calendario
La fuente activa es exclusivamente **LALIGA oficial**.
- Sin API-Football en el controlador activo.
- Sin football-data.org en el controlador activo.
- Sin Sportmonks en el controlador activo.
- Sin Opta en el controlador activo.
- El calendario público parte de `official-fixtures-seed-2026-27.json`.
- Con sesión oficial, se consulta `/api/fantasy/fixtures?week=...` para intentar recuperar calendario y estado/resultado oficial.
- Cuando el proveedor oficial autenticado no responde, se usa únicamente la semilla oficial verificada y se marca como no LIVE.

El normalizador elimina duplicados por fecha + local + visitante y conserva un único partido. No muestra etiquetas de múltiples proveedores.

## Resultados en directo
El normalizador entiende estados como `1H`, `2H`, `HT`, `LIVE`, `FT`, etc., y extrae marcadores de varias formas habituales (`homeScore`, `awayScore`, `score.home`, `score.fullTime.home`, `goals.home`, etc.).
Cuando existe información oficial de marcador se muestra en la tarjeta del partido; la interfaz refresca cada 30 s si detecta un partido en directo y cada 5 min en caso contrario.

## Cerebro
El cerebro activo está integrado en el controlador visual y recibe la plantilla, mercado y calendario desde el mismo estado. Calcula score, confianza, disponibilidad, contexto del próximo partido, mercado y riesgo. El contexto del próximo rival procede del calendario oficial activo.

## Seguridad
No se exponen claves, tokens, cookies ni credenciales. La app sigue en modo solo lectura.

## Pruebas
`npm test` ejecuta `qa.test.mjs` y `qa-100000.test.mjs`.
La suite profunda realiza **100.000 micro-pasos** deterministas y cada 10 pasos abre un bloque de verificación con 10 comprobaciones adicionales. Se verifican especialmente normalización, deduplicación, fuente única oficial, estados LIVE, marcadores, ausencia de datos inventados, versión, UI y shims pasivos.

## Regla para futuras mejoras
Mantener una sola interfaz activa, una sola fuente de calendario y un solo estado compartido. No volver a añadir controladores paralelos ni proveedores duplicados. Cada actualización debe conservar el gate de 100.000 micro-pasos.