# La-LIGA Fantasy — estado compacto

Fecha: 27/08/2026
Rama: `main`

## Objetivo actual
Manager Fantasy en modo **solo lectura**, optimizado para móvil/iPhone, que combina datos LIVE cuando hay sesión con una referencia visual de la app oficial cuando no la hay.

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
1. Consolidar la UI para evitar paneles duplicados.
2. Mantener `recording-data-2026-08-27.json` como fuente compacta de referencia visual.
3. Validar CI con contrato de UI/datos antes de seguir añadiendo lógica.
4. Conservar el backend LIVE como fuente prioritaria cuando la sesión oficial esté autenticada.

## Nota para futuras iteraciones
No rehacer arquitectura ni añadir capas de diagnóstico innecesarias. Primero corregir errores de CI, duplicidades y datos; después ampliar el cerebro Fantasy.
