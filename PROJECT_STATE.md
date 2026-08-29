# La-LIGA Fantasy — estado compacto

Fecha: 29/08/2026
Rama de referencia: `main`
Versión backend: `2.15.0`

## Estado actual
Aplicación móvil horizontal para LALIGA Fantasy, en modo solo lectura, con una interfaz principal grande y táctil. La arquitectura debe conservar **un único estado compartido**, **un único calendario visible** y **un único controlador de refresco**; los clientes heredados quedan como shims pasivos.

## Cerebro propio
`brain-core-v27.mjs` mantiene el modelo adaptativo interno: rendimiento, disponibilidad, contexto, mercado y riesgo; sesgos por posición, error medio, deriva y muestras pendientes. `brain-history-v28.mjs` añade memoria histórica persistente por jugador. `brain-calibration-v28.mjs` calibra la confianza con 10 intervalos sin modificar el score. `brain-reliability-v29.mjs` añade una capa auditable de fiabilidad que combina evidencia, calidad/completitud, frescura, deriva y calidad de fuente. `brain-reliability-hook-v29.mjs` integra esa capa en predicciones y status.

El cerebro aprende solo a partir de resultados observados. No se reescribe arbitrariamente el código fuente. El aprendizaje modifica el modelo persistente y queda registrado para auditoría.

## Render
`render.yaml` usa Node 24.14.1, `startCommand: npm start`, `healthCheckPath: /api/health`, región Frankfurt y cierre ordenado. El build ejecuta `npm install --no-audit --no-fund && npm run render:verify`, y `autoDeployTrigger: checksPass` evita el auto-despliegue de commits cuyo CI no haya pasado. `render-preflight.mjs` valida archivos, versión de Node, puerto y sintaxis antes del despliegue.

`BRAIN_STATE_DIR=/var/data/brain` es la ubicación preparada para modelo/historial/cache. Sin disco persistente el servicio sigue siendo funcional, pero ese estado local puede ser efímero; Render reserva los discos persistentes para servicios compatibles de pago.

## Calendario autónomo
La pantalla **Partidos** se carga automáticamente, sin botones manuales. `calendar-autonomous-v30.js` es el único renderizador activo. Prioridad: LALIGA oficial autenticada → FutbolFantasy.com como contraste → caché persistente → semilla oficial protegida. Los estados LIVE/resultados solo se muestran si una fuente los proporciona.

## FutbolFantasy.com
El sistema obtiene y normaliza datos públicos cuando están disponibles. La capa de datos inspecciona inicio, LaLiga, alineaciones probables, lesionados y estadísticas y los presenta como contraste público, sin convertirlos silenciosamente en fuente oficial.

## Auto-reparación IA
La capa self-healing detecta fallos de CI, obtiene logs, genera huellas estables, consulta memoria histórica, propone parches mínimos, valida rutas/tamaño/secretos, ejecuta `npm test`, registra éxitos y aplica cooldown ante ciclos repetitivos. `main` no debe ser modificado directamente por el agente; las reparaciones llegan por PR.

## Pruebas obligatorias por actualización
- sintaxis de archivos tocados y dependencias;
- 100.000 micro-pasos del cerebro;
- 10.000 bloques de corrección;
- fuzz/recuperación;
- runtime/health/persistencia;
- calibración y fiabilidad;
- Render preflight;
- calendario autónomo de 10.000 casos / 50.000 aserciones;
- ausencia de duplicados y botones heredados;
- caché móvil/service worker;
- UI y datos públicos FutbolFantasy;
- self-healing y memoria de fallos.

Ante cualquier fallo, se corrige y se repite el bloque afectado con al menos 10 pruebas de corrección. No se fusiona una versión mientras exista un fallo conocido sin corregir.
