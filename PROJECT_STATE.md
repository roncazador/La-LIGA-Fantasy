# La-LIGA Fantasy — estado compacto

Fecha: 28/08/2026
Rama: `main`

## Objetivo actual
Manager Fantasy en modo **solo lectura**, optimizado para móvil/iPhone, que combina datos LIVE cuando hay sesión con una referencia visual de la app oficial cuando no la hay.

## Cerebro actual
`brain-engine-v25.js` queda como motor anterior. `brain-engine-v26.js` es ahora el motor activo y se carga una sola vez desde `connection-client.js`.

La v2.6 añade:
- confianza basada en campos realmente recibidos;
- penalización por información ausente sin tratarla como dato favorable/neutro;
- ajuste por posición;
- forma y momentum combinados con señal de precio/valor;
- riesgo explícito por rotación/lesión/estado textual;
- `transferScore` separado del score de alineación;
- decisiones `TITULAR`, `MANTENER`, `SALIDA`, `VIGILAR MERCADO`, `COMPRAR / PRIORIDAD`, `NO FORZAR` y `FALTA INFORMACIÓN`;
- distinción visible entre `LALIGA LIVE` y fuentes de referencia.

## Vista visual actual
El panel unificado debe mostrar, con navegación táctil:
- Mi equipo (`roncazador`)
- Rivales visibles de la liga
- Mercado observado
- Actividad
- Clasificación

La interfaz usa la estética oscura de la captura aportada: tarjetas, KPIs, botones rojos y scroll horizontal en pestañas.

## Datos de referencia
`recording-data-2026-08-27.json` es el snapshot compacto utilizado por la UI de grabación.
`video-reference-snapshot-2026-08-27.json` mantiene la referencia histórica más detallada.
Los datos de la grabación **no deben presentarse como LIVE**.

Referencia observada:
- jornada 3
- `roncazador`: #1, 109 PFSY
- valor: 269.039.595 €
- plantilla visible: 20/24 fichas
- saldo mercado: 40.542.121 €
- recompensa: 100.000 €

## Seguridad
Nunca poner claves API, tokens, cookies o credenciales en frontend o JSON público.
No activar compras, ventas, pujas ni modificaciones de plantilla.

## Siguiente prioridad
1. Validar CI completo del motor v2.6 y contrato de UI/datos.
2. Consolidar la UI para evitar paneles duplicados.
3. Conectar el `transferScore` con datos reales del mercado LIVE cuando la sesión oficial proporcione suficiente información.
4. Mantener `recording-data-2026-08-27.json` como fuente compacta de referencia visual.

## Nota para futuras iteraciones
No rehacer arquitectura ni añadir capas de diagnóstico innecesarias. Primero corregir errores de CI, duplicidades y datos; después ampliar el cerebro Fantasy sobre la base v2.6.
