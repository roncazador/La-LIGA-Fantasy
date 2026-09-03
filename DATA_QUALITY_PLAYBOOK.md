# Pauta de calidad de datos

## Objetivo
Evitar incoherencias entre calendario, clasificación y resultados cuando varias fuentes aportan información sobre el mismo partido.

## Regla de prioridad
1. Proveedor estructurado de mayor prioridad configurado.
2. Segundo proveedor estructurado disponible.
3. FutbolFantasy como contraste público.
4. Respaldo oficial estático solo para identidad o datos explícitamente marcados como fallback.

Nunca se promociona una cifra de una fuente de menor prioridad sobre otra de mayor prioridad salvo que la fuente superior no aporte ese campo.

## Identidad del partido
La clave de deduplicación usa fecha UTC del día + local + visitante normalizados. No se debe depender del minuto exacto del saque inicial, porque distintos proveedores pueden publicar horas ligeramente diferentes.

## Resultados
Cada normalizador debe conservar `homeScore` y `awayScore` cuando la fuente los facilite. Un resultado final no puede aparecer como programado en otra vista por utilizar un estado técnico distinto.

## Presentación
La interfaz nunca debe enseñar estados técnicos como `TIMED`, `FT` o `NS`. Se presentan como `PRÓXIMO`, `EN DIRECTO`, `FINALIZADO`, `APLAZADO`, `CANCELADO` o `ESTADO NO DISPONIBLE`.

## Control automático en cada cambio
- comprobar sintaxis de los normalizadores y clientes modificados;
- comprobar que la clave de fixture deduplica diferencias menores de hora;
- comprobar extracción de marcador de cada proveedor;
- comprobar que faltantes se representan con `—` y no con valores inventados;
- comprobar que Calendario y Clasificación siguen siendo vistas independientes;
- comprobar que el directorio mantiene los 20 clubes de identidad;
- ejecutar la batería completa de CI antes de tocar `main`.

## Pauta de corrección
Cuando aparece una incoherencia:
1. reproducirla con un caso mínimo;
2. identificar si el fallo está en fuente, normalización, deduplicación o presentación;
3. corregir una sola capa;
4. añadir una regresión automática;
5. ejecutar CI completo;
6. solo después continuar con la siguiente mejora.

## FutbolFantasy
La incorporación de datos se hace por capas: primero disponibilidad y salud de fuente; después datos de equipo; después plantilla/lesiones; y por último métricas adicionales. Si una sección no tiene correspondencia fiable, se mantiene `—`.
