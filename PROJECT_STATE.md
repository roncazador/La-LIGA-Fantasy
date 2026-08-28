# La-LIGA Fantasy — estado compacto

Fecha: 28/08/2026
Rama: `main`

## Estado v2.13 / Cerebro v2.7
La aplicación visible está consolidada en un único controlador oficial: `calendar-client.js`. Los clientes heredados `dashboard-client.js` y `connection-client.js` son shims pasivos y no hacen consultas duplicadas.

El arranque de producción pasa ahora por `brain-host-v27.mjs`, que coloca el cerebro delante del backend sin alterar la API existente.

## Cerebro propio
`brain-core-v27.mjs` implementa un modelo adaptativo interno, no dependiente de un proveedor externo de IA. Mantiene pesos aprendibles para rendimiento, disponibilidad, contexto, mercado y riesgo; además guarda sesgo por posición, error medio, deriva y muestras pendientes.

El cerebro aprende de resultados observados cuando la plataforma aporta campos de puntos de jornada/semana. Cada observación guarda una predicción pendiente; cuando aparece la etiqueta real, el cerebro aplica una actualización incremental de pesos. También controla la deriva para detectar degradación del modelo.

La memoria se persiste en `BRAIN_STATE_DIR`. En producción está configurada en `/var/data/brain`; para que sea realmente persistente entre despliegues y reinicios de Render hace falta un almacenamiento persistente.

## Automatización
`brain-host-v27.mjs` intercepta el dashboard oficial para aprender automáticamente y ejecuta además un ciclo autónomo cada 20 minutos contra las rutas internas de jugadores, lesiones y clasificación. Estas fuentes auxiliares sirven para señales de entrenamiento; no sustituyen la fuente oficial del calendario visible.

## Interfaz
Se presenta una única interfaz grande, táctil y ligera con seis apartados: **Inicio**, **Cerebro**, **Equipo**, **Partidos**, **Mercado** y **Liga**.
Los botones principales tienen un área de toque amplia y el calendario aparece también en Inicio.

## Calendario
La UI activa usa exclusivamente **LALIGA oficial**.
- La fuente visible del calendario es LALIGA oficial.
- El calendario parte de `official-fixtures-seed-2026-27.json`.
- Con sesión oficial, se consulta `/api/fantasy/fixtures?week=...` para calendario y estado/resultado.
- Sin respuesta autenticada, se utiliza únicamente la semilla oficial.
- Los partidos se deduplican por fecha + local + visitante.

## Resultados en directo
El normalizador interpreta estados `1H`, `2H`, `HT`, `LIVE`, `FT`, etc., y busca marcadores en las formas habituales de payload. Nunca inventa un resultado.

## Caché móvil
El service worker se ha versionado a `fm-v213` para forzar la sustitución del recurso anterior y evitar que iPhone/Edge reutilice la UI antigua.

## Render
`render.yaml` conserva `npm start`, por lo que Render arrancará automáticamente el nuevo `brain-host-v27.mjs` a través de `package.json`. No hace falta cambiar manualmente el Start Command.
`BRAIN_STATE_DIR=/var/data/brain` ya queda declarado en el Blueprint. Para conservar el aprendizaje real entre reinicios/despliegues hay que montar un disco persistente en `/var/data` o migrar la memoria a Postgres/Key Value.

## Seguridad
No se exponen claves, tokens, cookies ni credenciales. La app sigue en modo solo lectura.

## Pruebas
`npm test` mantiene el gate de calendario de **100.000 micro-pasos**.
El nuevo workflow `Brain v2.7 tests` ejecuta comprobaciones de sintaxis y **100.000 micro-pasos de predicción**, con una corrección verificable cada 10 pasos; comprueba normalización de pesos, estabilidad numérica, aprendizaje, deriva y persistencia.

Se han eliminado dos workflows one-shot que podían modificar código heredado automáticamente y deshacer mejoras posteriores.

## Regla para futuras mejoras
Mantener una sola interfaz activa, una sola fuente de calendario, un solo estado compartido y un único controlador de refresco. El cerebro puede evolucionar de forma incremental, pero cada cambio debe medir si mejora frente al estado anterior y conservar el histórico de aprendizaje.
