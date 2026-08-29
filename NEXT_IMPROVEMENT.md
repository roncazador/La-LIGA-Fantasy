# Next improvement: Brain v2.8 confidence calibration

## Goal
Replace the current heuristic confidence value with an auditable calibration layer that compares predicted confidence against observed accuracy.

## Contract
- Keep the v2.7 scoring model and weights intact.
- Store confidence with pending predictions.
- Track ten confidence buckets (0-9) with sample count and successful predictions (absolute error <= 3 points).
- Expose calibration error and sample count in brain status.
- Do not let calibration alter player scores until enough labeled samples exist.
- Persist calibration atomically with the existing model.
- Add deterministic tests for bucket placement, learning, persistence and status output.
