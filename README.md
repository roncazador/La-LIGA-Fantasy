# LALIGA Fantasy Manager · roncazador · v2.10.0

Aplicación web/PWA para análisis de LALIGA Fantasy, preparada para GitHub + Render y uso principal desde iPhone.

## Estructura
- `index.html` — interfaz y motor de análisis.
- `server.mjs` — backend Node, proxy de lectura y autenticación OIDC.
- `config.mjs` — configuración canónica y compatibilidad con variables antiguas.
- `connection-client.js` — estado de conexión, SSO y sincronización automática en navegador.
- `dashboard-client.js`, `calendar-client.js`, `data-client.js`, `recording-client.js` — clientes especializados.
- `manifest.json`, `sw.js` — soporte PWA.
- `.env.example` — nombres correctos de variables de entorno.
- `test.mjs` — pruebas de seguridad/configuración y política solo lectura.

## Render
- Runtime: Node
- Root Directory: vacío
- Build Command: `npm install`
- Start Command: `npm start`
- Health Check Path: `/api/health`

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

## Cerebro
El motor usa rendimiento, minutos, titularidad, contexto de próximas jornadas, tendencia, precio/valor, riesgo de rotación, riesgo físico, confianza de datos y frescura de sincronización. Los pesos internos no representan la fórmula oficial de puntuación de LALIGA.

## Importante sobre correo y contraseña
No se añade un formulario para introducir el correo y contraseña de LALIGA. LALIGA documenta el uso de Single Sign-On común para sus activos; la implementación segura es delegar el acceso al proveedor y recibir una sesión autorizada, no interceptar las credenciales. citeturn778401view0

## Tests
Ejecutar:

`npm test`

Las pruebas cubren, entre otras cosas, rutas de escritura bloqueadas, configuración, requisitos OIDC y lista blanca de archivos públicos.
