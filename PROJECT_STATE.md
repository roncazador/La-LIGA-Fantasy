# La-LIGA Fantasy — estado compacto

Fecha: 02/09/2026
Rama de referencia: `main`
Versión backend: `2.17.0`
CI contract: extensible y versionado; la batería incluye Project, Brain, Calendar, Recording, Maintenance, Governance y asimilación.

## Estado actual
Aplicación móvil horizontal para LALIGA Fantasy, en modo solo lectura, con una interfaz principal grande, táctil y dinámica. La arquitectura conserva **un único estado compartido**, **un único calendario visible** y **un único controlador de refresco**; los clientes heredados quedan como shims pasivos.

## Orden de la pantalla principal
La interfaz prioriza: `roncazador` → Puntos Fantasy → Saldo → Plantilla → Alineación recomendada → Jugadores con más puntos probables → Fichajes recomendados → IA de cerebro → Calendario. La estética global reutiliza el lenguaje visual dinámico del calendario.

## Cerebro propio
`brain-core-v27.mjs` mantiene el modelo adaptativo interno: rendimiento, disponibilidad, contexto, mercado y riesgo; memoria histórica, calibración y fiabilidad auditable. El cerebro guarda predicciones como pendientes y **solo aprende cuando el resultado es final**. Las jornadas parciales no alteran pesos ni calibración.

Los errores recientes, MAE, deriva y calidad de datos reducen la confianza mostrada sin modificar el score base. Las escrituras del modelo son atómicas y el estado persistente está preparado para Render mediante `BRAIN_STATE_DIR`.

## Cultivos y retroalimentación
`cultivos-v1.mjs` mantiene un estado persistente y acotado. Recibe señales del cerebro, automatización, evidencias y vídeo. La versión 1.3 añade `syncFromHandoff()`: el resultado estructurado de la batería/CI puede alimentar Cultivos para priorizar mejoras, **sin escribir directamente en el cerebro** y respetando `final-only`.

La asimilación solo acepta una batería completamente verde. Las evidencias no confirmadas, incluidos vídeos, permanecen fuera del aprendizaje automático hasta confirmación humana.

## Automatizaciones
`automation-hub-v1.js` es el dueño único de la telemetría de automatización. Recibe eventos de calendario, capas y errores, mantiene estado acotado y expone contratos versionados.

`app-dynamics-v37.js` muestra salud, última actualización, próximo ciclo, antigüedad, fallos y reintentos. La recuperación del calendario solo se activa ante un fallo realmente perteneciente al calendario, con backoff 5/15/30 s, y cancela reintentos pendientes cuando la capa se recupera.

GitHub genera informes estructurados de batería y handoff. El informe incluye workflows/jobs fallidos, logs recortados, huellas y recomendaciones. La integración se limita a datos de ingeniería; no se asume una comunicación nativa GitHub→ChatGPT que la plataforma no proporcione.

## Calendario autónomo
`calendar-autonomous-v35.js` es el renderizador visible principal. Se carga automáticamente, sin botones manuales, actualiza estados y marcador cada 15 s y permite navegar por jornadas. La jornada inicial se infiere primero por partidos LIVE y después por partidos del día local de Madrid.

Prioridad de datos: LALIGA oficial autenticada → FutbolFantasy.com como contraste → caché persistente → semilla protegida. La fuente de contraste puede completar campos ausentes y estados válidos sin degradar resultados finales.

## Detalle de partido y FutbolFantasy
`match-detail-ui-v31.js` resuelve primero por `match.id`, después por fecha/equipos, y consume la salida normalizada de `/api/futbolfantasy/data`. Las alineaciones, lesiones y puntos históricos permanecen separados de las estimaciones del cerebro.

## Evidencia de grabaciones
`evidence-isolation-v1.js` mantiene grabaciones/capturas en un dominio separado. El vídeo del 01/09/2026 está registrado mediante `recording-video-2026-09-01.json` con hash SHA-256, duración, resolución, codecs y observaciones muestreadas. El MP4 original no se almacena dentro del repositorio; queda como evidencia externa aportada por el usuario.

## Render y configuración
`render.yaml` usa Node 24.14.1, `startCommand: npm start`, `healthCheckPath: /api/health`, región Frankfurt y `autoDeployTrigger: checksPass`. Existen slots documentados para proveedores públicos (`FOOTBALL_DATA_TOKEN`, `SPORTMONKS_API_TOKEN`, `API_FOOTBALL_API_KEY`, `OPTA_API_TOKEN`) y para IA opcional (`OPENAI_API_KEY`), todos con `sync: false`. No se deben introducir valores reales en Git.

## Ramas
Las ramas funcionales antiguas se consideran históricos/puntos de partida. No hay PRs abiertos actualmente. Las nuevas mejoras se crean desde `main`, pasan CI completo y solo después se fusionan.

## Batería obligatoria
Cada actualización debe validar sintaxis, 100.000 micro-pasos, 10.000 bloques de corrección, fuzz/recuperación, memoria, calibración, fiabilidad, Render preflight, calendario autónomo, merge de fuentes, UI, FutbolFantasy, detalle de partido, PWA, self-healing, Automation Hub, handoff, Cultivos, asimilación y archivo reproducible.

Ante cualquier fallo: localizar la causa, corregirla, repetir el bloque afectado y volver a ejecutar la batería completa. No se integra una versión con fallos conocidos.
