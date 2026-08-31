# Siguiente pasada: modelo Fantasy sobre datos normalizados

## Objetivo
Aplicar predicción Fantasy únicamente sobre datos observados y normalizados, manteniendo separadas las estimaciones del aprendizaje final-only.

## Datos de contraste
- Alinear equipos y jugadores con identidad canónica.
- Mantener alineaciones probables, lesiones, estadísticas y puntos históricos como señales observadas.
- Conservar trazabilidad mediante páginas y checksums.

## Modelo
- Las posibles puntuaciones son estimaciones y nunca puntos oficiales.
- No aprender de predicciones pendientes.
- Validar cualquier nueva señal antes de incorporarla al cerebro.

## Calidad
- Corrección estructural del sistema existente antes de añadir nuevas capas.
- Ejecutar la batería completa antes de integrar.
- No fusionar una versión con workflows fallidos.
- Validar siempre el merge ref actualizado del PR.
