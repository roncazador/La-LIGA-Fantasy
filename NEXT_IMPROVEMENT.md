# Siguiente pasada: corrección estructural del sistema existente

## Objetivo
Corregir errores de lógica y consistencia detectados al auditar ramas, cerebro, calendario, Render, memoria y la interfaz, sin introducir funcionalidades nuevas.

## Cerebro
- Aprender únicamente de resultados finales observados.
- Mantener predicción pendiente hasta disponer del resultado final.
- Evitar fugas por datos parciales o por aprender del mismo snapshot que genera la predicción.
- Reducir confianza cuando los errores recientes o el error medio indican sobreconfianza.
- Conservar separadas confianza bruta, calibrada y mostrada.

## Calendario
- Mantener LALIGA oficial como identidad primaria.
- Completar campos oficiales vacíos con contraste válido sin degradar estados finales.
- Rechazar marcadores y jornadas fuera de rango.
- Mantener deduplicación, caché y fallback existentes sin duplicar renderizadores.

## Memoria y calidad
- Registrar correcciones estructurales conocidas para que el sistema de auto-reparación las use como evidencia previa.
- Mantener contratos sincronizados con la versión real.
- Preservar el modo solo lectura y la arquitectura actual.

## Interfaz
Refinar únicamente jerarquía visual, espaciado y legibilidad de la interfaz actual, especialmente en iPhone horizontal, sin añadir apartados o flujos nuevos.
