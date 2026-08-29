# LALIGA Fantasy Manager · roncazador · v2.15.0

Aplicación web/PWA para análisis de LALIGA Fantasy, preparada para GitHub + Render y uso principal desde iPhone.

## Estructura
- `index.html` — interfaz principal.
- `server.mjs` — backend Node, proxy de lectura y autenticación OIDC.
- `brain-host-v27.mjs` / `brain-core-v27.mjs` — runtime y modelo adaptativo.
- `brain-history-v28.mjs`, `brain-calibration-v28.mjs`, `brain-reliability-v29.mjs` — memoria, calibración y fiabilidad del cerebro.
- `calendar-service-v29.mjs`, `calendar-autonomous-v30.js` — calendario único y su renderizador activo.
- `connection-client.js`, `dashboard-client.js`, `data-client.js`, `recording-client.js` — clientes especializados.
- `manifest.json`, `sw.js` — soporte PWA.
- `.env.example` — nombres correctos de variables de entorno.
- `.github/self-healing/` — agente y memoria de correcciones del sistema de auto-reparación.

## Render
- Runtime: Node 24.14.1.
- Root Directory: vacío.
- Build Command: `npm install --no-audit --no-fund && npm run render:verify`.
- Start Command: `npm start`.
- Health Check Path: `/api/health`.
- El servicio usa `0.0.0.0:10000`.
- El despliegue automático está condicionado a checks de GitHub.
- `/var/data/brain` es la ubicación preparada para modelo, historial y caché. La persistencia entre reinicios/despliegues requiere almacenamiento persistente de Render; sin él el proceso sigue funcionando, pero el estado local puede ser efímero.

## Conexión LALIGA
LALIGA utiliza un sistema de Single Sign-On dentro de LALIGA Ecosistema. El proyecto usa el flujo OAuth/OIDC del proveedor cuando existe un cliente autorizado. La interfaz nunca solicita ni guarda la contraseña del usuario.

Cuando OAuth está configurado:
1. `Conectar con LALIGA` abre el inicio de sesión oficial.
2. LALIGA devuelve el código al callback configurado.
3. El backend mantiene la sesión con cookie HttpOnly.
4. El backend consulta únicamente rutas de lectura de Fantasy.
5. El navegador sincroniza automáticamente mientras la página está activa.
6. Si el token caduca, el backend intenta refrescarlo cuando el proveedor lo permite.

## Variables canónicas
`LALIGA_API_BASE_URL`
`LALIGA_COMPETITION_ID`
`SESSION_COOKIE_NAME`
`FOOTBALL_DATA_TOKEN`
`FOOTBALL_DATA_COMPETITION`
`FOOTBALL_DATA_DAYS`
`LALIGA_AUTHORIZE_URL`
`LALIGA_OAUTH_CLIENT_ID`
`LALIGA_REDIRECT_URI`
`LALIGA_SIGNIN_POLICY`
`LALIGA_TOKEN_URL`
`FRONTEND_URL`
`IOS_SUCCESS_REDIRECT`
`SECURE_COOKIE`
`ALLOW_ORIGIN`

Los secretos deben existir únicamente como variables de entorno de Render. No subir `.env`, contraseñas, cookies, access tokens ni refresh tokens al repositorio.

## Seguridad
- El backend mantiene la política de solo lectura: no hay compras, ventas, pujas, clausulazos ni cambios de alineación.
- Las credenciales de usuario nunca se reciben en `index.html`, `connection-client.js` ni GitHub.
- El estado LIVE se distingue del estado local o de referencia.
- Cuando faltan datos, el motor conserva `N/D` en lugar de inventar valores.
- El endpoint de aprendizaje del cerebro permanece protegido por `BRAIN_ADMIN_TOKEN`.

## Cerebro
El modelo conserva el scoring existente y añade únicamente capas ya integradas de memoria histórica, calibración y fiabilidad. Aprende de resultados observados, pero solo aplica el aprendizaje a resultados marcados como finales; una observación parcial permanece pendiente. Los errores recientes reducen la confianza para evitar sobreconfianza sin alterar el score. Los pesos, errores, deriva y calibración se persisten de forma atómica y auditable.

## Calendario
El calendario visible es único y se carga automáticamente. La fuente oficial LALIGA mantiene la identidad primaria; FutbolFantasy se utiliza como contraste. Al fusionar registros, una fuente secundaria puede completar únicamente campos que falten y aportar un estado más avanzado, pero nunca desplaza un resultado oficial final ni degrada información ya válida. Los marcadores inválidos se descartan.

## Pruebas
Ejecutar `npm test`. La batería incluye regresión profunda del cerebro, fuzz y recuperación, memoria histórica, calibración, fiabilidad, calendario autónomo, preflight de Render, contrato de despliegue, auto-reparación y contratos de interfaz/datos.
