# Investigación de funcionalidades de terceros

Fecha: 2026-09-04

Se revisaron repositorios públicos de GitHub relacionados con `futbolfantasy`, `La Liga Fantasy`, análisis, predicción y automatización fantasy. Las implementaciones de terceros se usan como referencia funcional, no como copia automática de código.

## Hallazgos útiles

### 1. Probabilidad de titularidad
`sergioalmela/la-liga-fantasy-analyzer` expone un servicio específico de probabilidades de titularidad y valida de forma estricta la entrada de jugadores antes de calcularla. Referencia: `src/app/api/starting-probabilities/route.ts`.

Aplicación propuesta en Fantasy: añadir al detalle de jugador una señal opcional `Probabilidad de titularidad`, con porcentaje, nivel de confianza y fecha de actualización. Debe desaparecer cuando no exista evidencia suficiente y nunca rellenarse con una cifra inventada.

### 2. Radar de oportunidades
El mismo proyecto separa una vista de oportunidades del resto del flujo y combina filtros por posición con señales de mercado y otros indicadores. Referencia: `src/app/leagues/[leagueId]/[teamId]/opportunities/page.tsx`.

Aplicación propuesta: crear una sección compacta `Oportunidades` que priorice jugadores según señales verificables: tendencia de valor, disponibilidad, probabilidad de titularidad, calendario y riesgo. El sistema debe explicar qué señales han provocado cada recomendación.

### 3. Tendencias de mercado
El proyecto analizado incorpora `MarketTrend` como fuente separada y la utiliza para ordenar oportunidades. Esto encaja con nuestro aprendizaje de decisiones, pero debe tratarse como evidencia y no como verdad absoluta.

Aplicación propuesta: historial de valor, variación reciente, tendencia y anomalía de mercado por jugador, almacenados con timestamp y fuente.

### 4. Radar de actividad
También incorpora un historial de actividad de liga con eventos, actores, importes y fechas. Referencia: `src/app/leagues/[leagueId]/[teamId]/activity/page.tsx`.

Aplicación propuesta: `Radar de liga` con actividad reciente de mercado/competición, útil para detectar cambios relevantes sin introducir ruido en la pantalla principal.

### 5. Defensa contra datos inválidos
La API de probabilidades de titularidad limita tamaño del cuerpo, número de jugadores, formato de IDs, precios y exige autenticación/origen válido. Este patrón es especialmente útil para nuestros futuros endpoints externos.

Aplicación inmediata: todos los adaptadores externos deben validar tamaño, forma, rangos, timestamps y procedencia antes de promover datos al estado útil del sistema.

## No se incorpora

- Scraping agresivo o técnicas destinadas a saltarse protecciones de terceros.
- Credenciales o claves encontradas en repositorios.
- Copias literales de código cuando una idea puede implementarse de forma independiente.
- Autoedición arbitraria del código de producción basada en datos externos.
- Métricas mostradas como oficiales cuando solo son estimaciones.

## Orden de integración

1. Probabilidad de titularidad con confianza y timestamp.
2. Tendencia de mercado histórica.
3. Radar de oportunidades explicado.
4. Radar de actividad separado del calendario/clasificación.
5. Mayor diversidad de fuentes para contrastar resultados.
6. Aprendizaje del cerebro exclusivamente sobre resultados finales confirmados.

## Regla de oro

Toda nueva fuente externa debe entrar como `observación + fuente + timestamp + estado de calidad`. Solo después de pasar validación, normalización, detección de conflictos y reglas de confianza puede alimentar una decisión.
