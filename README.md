# LALIGA Fantasy Manager · roncazador · v2.5.0

Aplicación web/PWA para análisis de LALIGA Fantasy, preparada para GitHub + Render y uso principal desde iPhone.

## Estructura
- `index.html` — interfaz y motor de análisis local.
- `server.mjs` — backend Node, proxy de lectura y autenticación OIDC.
- `config.mjs` — configuración canónica y compatibilidad con las variables antiguas usadas durante el montaje.
- `package.json` — scripts de arranque y pruebas.
- `manifest.json`, `sw.js` — soporte PWA.
- `.env.example` — nombres correctos de variables de entorno.
- `test.mjs` — pruebas de seguridad/configuración y política solo lectura.

## Render
- Runtime: Node
- Root Directory: vacío
- Build Command: `npm install`
- Start Command: `npm start`
- Health Check Path: `/api/health`

## Variables canónicas
Las variables que usa el backend son:

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

Durante el arranque se conservan alias para las cuatro variables antiguas que se llegaron a crear durante las pruebas, para que no rompan el servicio si permanecen en Render.

## Seguridad
- No se almacenan contraseñas ni tokens en `index.html`.
- El backend mantiene la política de solo lectura: no hay compras, ventas, pujas, clausulazos ni cambios de alineación.
- Los secretos deben existir únicamente en las variables de entorno de Render.
- El Service Worker usa una versión de caché renovada y trata `index.html` con estrategia network-first para evitar versiones antiguas tras un despliegue.

## OAuth LALIGA
OAuth queda preparado pero no se inventan credenciales. El redirect objetivo del servicio, una vez autorizado por el proveedor, es:

`https://YOUR-SERVICE.onrender.com/auth/callback`

Debe utilizarse únicamente si el registro oficial del proveedor acepta esa URI.

## Tests
Ejecutar:

`npm test`

Las pruebas actuales verifican, entre otras cosas, rutas de escritura bloqueadas, nombres canónicos, límites de configuración, requisitos OIDC y lista blanca de archivos públicos.
