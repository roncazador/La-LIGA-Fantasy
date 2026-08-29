# La-LIGA Fantasy — estado compacto

Fecha: 29/08/2026
Rama: `main`

## Estado actual
Aplicación móvil horizontal para LALIGA Fantasy, en modo solo lectura, con una interfaz principal grande y táctil. La arquitectura debe conservar **un único estado compartido**, **un único calendario visible** y **un único controlador de refresco**; los clientes heredados quedan como shims pasivos.

## Cerebro propio
`brain-core-v27.mjs` mantiene el modelo adaptativo interno: rendimiento, disponibilidad, contexto, mercado y riesgo; sesgos por posición, error medio, deriva y muestras pendientes. `brain-history-v28.mjs` añade memoria histórica persistente por jugador (jornada, puntos, minutos, titularidad, disponibilidad y tendencia reciente). `brain-history-hook-v28.mjs` incorpora esa memoria al contexto de predicción cuando hay suficiente histórico.

El cerebro aprende solo a partir de resultados observados. No se reescribe arbitrariamente el código fuente. El aprendizaje modifica el modelo persistente y queda registrado para auditoría.

## Automatización
`brain-host-v27.mjs` arranca delante del backend y ejecuta ciclos autónomos periódicos de observación de jugadores, lesiones y clasificación. La sesión LALIGA y sus tokens se manejan exclusivamente en servidor.

## Calendario autónomo v3.0
La pantalla **Partidos** se carga automáticamente, sin botones manuales. `calendar-autonomous-v30.js` es el único renderizador activo.

Prioridad de datos:
1. **LALIGA oficial autenticada**.
2. **FutbolFantasy.com** como fuente pública de contraste.
3. **Caché persistente del último calendario válido**.
4. `official-fixtures-seed-2026-27.json` como último recurso estructural.

Los partidos se deduplican por fecha + local + visitante. Los resultados/estados LIVE solo se muestran cuando una fuente proporciona esa información; nunca se inventan.

`calendar-service-v29.mjs` incorpora caché, stale-if-error, circuit breaker, timeout, límite de respuesta, validación de fechas/equipos e integridad. `brain-host-v27.mjs` persiste además el último calendario válido en `calendar-cache-v30.json`.

## FutbolFantasy.com
`calendar-service-v29.mjs` obtiene y normaliza el calendario público cuando está disponible. `futbolfantasy-data-v30.mjs` inspecciona varias áreas públicas (inicio, LaLiga, alineaciones probables, lesionados y estadísticas) y expone un inventario seguro mediante `/api/futbolfantasy/data`.
`futbolfantasy-ui-v30.js` muestra en el apartado Datos cuántas páginas, enlaces, títulos y registros de calendario públicos se han podido recoger. Se mantiene explícita la diferencia entre contraste público y fuente oficial.

## Interfaz v30
La navegación principal se concentra en **Inicio, Cerebro, Plantilla, XI óptimo, Partidos y Mercado**, con un botón **Más** para apartados secundarios. Los botones táctiles son grandes y el calendario ocupa un bloque visual principal.

## Service Worker / móvil
El caché se ha invalidado a `fm-v301` y precarga los nuevos clientes autónomos. Las rutas `/api/*` se solicitan sin caché. El objetivo es evitar que Edge/iPhone siga ejecutando una versión antigua del calendario.

## Render
`render.yaml` sigue usando `startCommand: npm start` y `healthCheckPath: /api/health`. `npm start` carga el hook de memoria histórica y `brain-host-v27.mjs`.
`BRAIN_STATE_DIR=/var/data/brain` es la ubicación preparada para memoria/modelo/cache. Para conservar realmente el aprendizaje y el calendario cacheado entre reinicios/despliegues de Render se necesita almacenamiento persistente compatible; no se debe asumir que el disco efímero conserva estos archivos.

## Seguridad
- modo solo lectura;
- no se envían acciones de compra/venta/alineación;
- no se exponen secretos al cliente;
- `/api/brain/learn` requiere `BRAIN_ADMIN_TOKEN`;
- límites de cuerpo/respuesta y timeouts;
- fallos de fuentes externas no deben dejar el calendario vacío si existe caché/semilla válida;
- proveedores externos no pueden desplazar silenciosamente la fuente oficial.

## Pruebas obligatorias por actualización
Cada mejora debe pasar como mínimo:
- sintaxis de todos los archivos tocados y de sus dependencias;
- batería profunda del cerebro de 100.000 micro-pasos;
- bloques de corrección cada 10 iteraciones;
- fuzz/recuperación ante datos corruptos;
- runtime/arranque y health check;
- persistencia y recarga de memoria;
- contrato de despliegue Render;
- regresión de calendario autónomo de 10.000 casos;
- comprobación de ausencia de duplicados y botones heredados;
- comprobación de caché móvil/service worker;
- comprobaciones de interfaz y datos públicos de FutbolFantasy.

Cuando una prueba falla, se corrige el problema y se vuelve a ejecutar el bloque afectado con al menos 10 casos de corrección antes de cerrar la versión. Nunca se debe marcar una actualización como validada mientras haya un fallo conocido sin corregir.

## Reglas permanentes de futuras mejoras
Mantener una sola interfaz activa, una sola fuente oficial de calendario, un solo estado compartido, un único controlador de refresco, botones grandes, diseño sencillo para móvil horizontal, cero datos duplicados, calendario siempre visible y carga automática. El cerebro debe evolucionar incrementalmente con datos reales, medir si mejora respecto al estado anterior, conservar memoria histórica y no reescribirse de forma destructiva.
