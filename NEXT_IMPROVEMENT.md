# Siguiente pasada: modelo Fantasy sobre datos normalizados

## Orden de trabajo
1. Corrección estructural del sistema existente antes de añadir nuevas capas.
2. Validación completa de contratos y regresión.
3. Aplicar el modelo de posibles puntos sobre datos observados ya normalizados.
4. Validar las estimaciones sin contaminar el aprendizaje final-only.
5. Integrar únicamente con todos los workflows verdes.

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
- Ejecutar la batería completa antes de integrar.
- No fusionar una versión con workflows fallidos.
- Validar siempre el merge ref actualizado del PR.
