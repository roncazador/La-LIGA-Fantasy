# Siguiente pasada: Match Center y detalle unificado

## Orden de trabajo
1. Mantener una sola frontera de datos: identidad canónica, deduplicación y salud de fuentes antes de renderizar.
2. Mantener un solo flujo activo: Calendario → Partido → Equipo, dejando los módulos legacy fuera del cargador principal.
3. Mejorar el Match Center sobre la misma fuente: filtros de estado, partido, dos equipos, XI contrastado, candidatos y estado de jugadores.
4. Hacer visible el estado de confianza del dato: real, respaldo oficial, parcial o degradado, sin rellenar huecos.
5. Añadir pruebas de contrato para identidad de equipos, duplicaciones, fuentes caídas y conflictos entre capas.
6. Retirar progresivamente código legacy solo cuando sus contratos queden cubiertos por el flujo nuevo.
7. Ejecutar los siete workflows y no fusionar a `main` mientras cualquiera esté pendiente o falle.

## Regla de datos
- No inventar nombres, probabilidades, puntos ni estados.
- Las cifras Fantasy no oficiales se presentan como estimaciones u observaciones.
- Los datos de respaldo llevan marca explícita y nunca sustituyen silenciosamente al dato vivo.
- Un jugador sin equipo no puede aparecer en ningún XI.
- Un mismo jugador no puede duplicarse dentro del mismo equipo por diferencias de nombre de proveedor.

## Arquitectura de seguridad
- `futbolfantasy-normalizer-v33.mjs`: parsing y normalización de fuentes públicas.
- `futbolfantasy-integrity-v1.mjs`: frontera de integridad, identidad, deduplicación y sanitización.
- `futbolfantasy-data-v30.mjs`: caché, last-good y señalización de degradación.
- `calendar-focus-v1.js`: único núcleo activo de interacción de partido/equipo.
- `match-center-ui-v1.js`: presentación; no crea otro flujo de datos.
- Legacy de detalle: disponible para compatibilidad histórica, pero no se carga en `connection-client.js`.

## Criterio de salida
La mejora no se considera terminada hasta que el comportamiento funcional y las siete verificaciones CI estén verdes sobre el mismo commit candidato.
