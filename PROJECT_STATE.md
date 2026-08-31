# La-LIGA Fantasy — estado compacto

Fecha: 31/08/2026
Rama de referencia: `main`
Versión backend: `2.15.0`
CI contract: extensible (mínimo 65 comprobaciones)

## Estado actual
Aplicación móvil horizontal para LALIGA Fantasy, en modo solo lectura, con una interfaz principal grande y táctil. La arquitectura conserva **un único estado compartido**, **un único calendario visible** y **un único controlador de refresco**; los clientes heredados quedan como shims pasivos.

## Cerebro propio
`brain-core-v27.mjs` mantiene el modelo adaptativo interno: rendimiento, disponibilidad, contexto, mercado y riesgo; sesgos por posición, error medio, deriva y muestras pendientes. `brain-history-v28.mjs` añade memoria histórica persistente por jugador. `brain-calibration-v28.mjs` calibra la confianza con 10 intervalos sin modificar el score. `brain-reliability-v29.mjs` añade una capa auditable de fiabilidad que combina evidencia, calidad/completitud, frescura, deriva y calidad de fuente. `brain-reliability-hook-v29.mjs` mantiene separadas la confianza bruta, calibrada y mostrada.

El cerebro guarda una predicción como pendiente y **solo aprende cuando el resultado está marcado como final**. Las jornadas parciales no alteran los pesos ni la calibración. Los pendientes antiguos se descartan. Los errores recientes y el error medio reducen la confianza para evitar sobreconfianza sin alterar el score. Cada aprendizaje queda registrado con resultado de éxito/fallo y es persistido de forma atómica.

## Render
`render.yaml` usa Node 24.14.1, `startCommand: npm start`, `healthCheckPath: /api/health`, región Frankfurt y cierre ordenado. El build ejecuta `npm install --no-audit --no-fund && npm run render:verify`, y `autoDeployTrigger: checksPass` evita el auto-despliegue de commits cuyo CI no haya pasado. `render-preflight.mjs` valida archivos, versión de Node, puerto y sintaxis antes del despliegue.

`BRAIN_STATE_DIR=/var/data/brain` es la ubicación preparada para modelo/historial/cache. Sin disco persistente el servicio sigue siendo funcional, pero ese estado local puede ser efímero.

## Calendario autónomo
La pantalla **Partidos** se carga automáticamente, sin botones manuales. `calendar-autonomous-v30.js` es el único renderizador activo. Prioridad: LALIGA oficial autenticada → FutbolFantasy.com como contraste → caché persistente → semilla oficial protegida.

Durante la fusión de fuentes, LALIGA oficial conserva la identidad primaria, pero una fuente de contraste puede **completar campos que falten** (marcador, jornada) y aportar un estado más avanzado como LIVE, sin degradar un estado final ni sustituir la identidad oficial. Marcadores y jornadas fuera de rango se descartan.

## FutbolFantasy.com
`futbolfantasy-normalizer-v33.mjs` centraliza la extracción y normalización de fuentes públicas: página de LaLiga, alineaciones probables, lesionados, estadísticas y puntos de jugadores. Normaliza nombres de equipos, probabilidades de titularidad, estados físicos, filas tabulares, puntos históricos, emparejamientos y evidencia por fuente, con deduplicación por jugador/equipo y checksum de página.

`futbolfantasy-data-v30.mjs` expone esa salida mediante `/api/futbolfantasy/data` con caché de 5 minutos y separación explícita entre datos observados y futuras predicciones del cerebro. El detalle de partido consume `lineups`, lesiones y puntos normalizados; cuando una fuente no aporta un dato no se inventa.

## Ramas preparadas
Se mantienen ramas independientes desde `main` para no mezclar futuras funcionalidades:
- `feat/match-detail-futbolfantasy-v32`: detalle de partido, alineaciones y datos de contraste.
- `feat/fantasy-points-model-v32`: evolución del modelo de posibles puntos Fantasy.
- `feat/live-market-v32`: mercado LIVE y sus contratos de datos.
- `feat/futbolfantasy-normalization-v33`: normalización y extracción pública actualmente en validación.

Estas ramas son puntos de partida; no se integrarán cambios funcionales hasta que la línea estable haya superado su regresión.

## Auto-reparación IA
La capa self-healing detecta fallos de CI, obtiene logs, genera huellas estables, consulta memoria histórica, utiliza también las **correcciones estructurales aprendidas**, propone parches mínimos, valida rutas/tamaño/secretos, ejecuta `npm test`, registra éxitos y aplica cooldown ante ciclos repetitivos. `main` no debe ser modificado directamente por el agente; las reparaciones llegan por PR.

## Interfaz
La interfaz mantiene las mismas secciones y flujos. El ajuste visual actual refina únicamente jerarquía, espaciado, contraste, foco accesible y disposición para iPhone horizontal. El calendario añade un detalle interactivo al tocar un partido, sin crear una segunda pantalla de calendario.

## Pruebas obligatorias por actualización
- sintaxis de archivos tocados y dependencias;
- 100.000 micro-pasos del cerebro;
- 10.000 bloques de corrección;
- fuzz/recuperación;
- runtime/health/persistencia;
- calibración y fiabilidad;
- Render preflight;
- calendario autónomo de 10.000 casos / 50.000 aserciones;
- regresión de merge de estados/marcadores y validación de rangos;
- ausencia de duplicados y botones heredados;
- caché móvil/service worker;
- UI y datos públicos FutbolFantasy;
- normalizador público y puntos históricos;
- detalle interactivo de partido;
- self-healing y memoria de correcciones.

Ante cualquier fallo, se corrige y se repite el bloque afectado con al menos 10 pruebas de corrección. No se fusiona una versión mientras exista un fallo conocido sin corregir.
