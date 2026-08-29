import { BrainV27 } from './brain-core-v27.mjs';
import { assessPredictionReliability, RELIABILITY_VERSION } from './brain-reliability-v29.mjs';

const originalPredict = BrainV27.prototype.predict;
const originalStatus = BrainV27.prototype.status;

BrainV27.prototype.predict = function predictWithReliability(player, context = {}) {
  const prediction = originalPredict.call(this, player, context);
  const rawConfidence = Number(prediction.rawConfidence ?? prediction.confidence ?? 0);
  const calibratedConfidence = Number(prediction.confidence ?? rawConfidence);
  const sourceQuality = context?.sourceQuality ?? (context?.source === 'official' ? 1 : 0.75);
  const observedAt = player?.updatedAt ?? player?.observedAt ?? context?.observedAt ?? null;
  const reliability = assessPredictionReliability({
    rawConfidence,
    calibratedConfidence,
    driftScore: this.state?.drift?.score ?? 0,
    labeledSamples: this.state?.labeledSamples ?? 0,
    featureValues: prediction.features ?? {},
    sourceQuality,
    observedAt
  });
  return {
    ...prediction,
    confidence: reliability.displayedConfidence,
    rawConfidence,
    reliability,
    reliabilityVersion: RELIABILITY_VERSION
  };
};

BrainV27.prototype.status = function statusWithReliability() {
  const status = originalStatus.call(this);
  const rawConfidence = Number(status.rawConfidence ?? status.confidence ?? 0);
  const calibratedConfidence = Number(status.confidence ?? rawConfidence);
  const reliability = assessPredictionReliability({
    rawConfidence,
    calibratedConfidence,
    driftScore: status.drift?.score ?? 0,
    labeledSamples: status.labeledSamples ?? 0,
    featureValues: {performance:1,availability:1,context:1,market:1,risk:1},
    sourceQuality: 1,
    observedAt: status.lastObservationAt ?? null
  });
  return {...status,reliability,reliabilityVersion:RELIABILITY_VERSION};
};
