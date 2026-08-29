import { createPlayerHistory, HISTORY_VERSION } from './brain-history-v28.mjs';
import { BrainV27 } from './brain-core-v27.mjs';

const dir = process.env.BRAIN_STATE_DIR || './.brain-data';
const history = createPlayerHistory({ dir });

const originalIngest = BrainV27.prototype.ingestDashboard;
const originalStatus = BrainV27.prototype.status;
const originalPredict = BrainV27.prototype.predict;

BrainV27.prototype.ingestDashboard = function ingestDashboardWithHistory(dashboard, meta = {}) {
  const result = originalIngest.call(this, dashboard, meta);
  try {
    const team = dashboard?.team?.data ?? dashboard?.team ?? {};
    const players = Array.isArray(team?.players)
      ? team.players
      : Array.isArray(team?.squad)
        ? team.squad
        : Array.isArray(team?.roster)
          ? team.roster
          : [];
    const week = dashboard?.week?.weekNumber
      ?? dashboard?.week?.number
      ?? dashboard?.week?.matchday
      ?? dashboard?.week?.currentWeek
      ?? meta.week;
    history.observe(players, { week, source: 'official' });
  } catch (error) {
    console.error(`[brain-history] dashboard history skipped: ${error.message}`);
  }
  return result;
};

BrainV27.prototype.predict = function predictWithHistory(player, context = {}) {
  const prediction = originalPredict.call(this, player, context);
  try {
    const profile = history.profile(player);
    if (profile.found && profile.labeledSamples >= 2) {
      const recent = Number(profile.recentAveragePoints);
      const trend = Number(profile.formTrend);
      if (Number.isFinite(recent)) {
        const historicalSignal = Math.max(
          0,
          Math.min(
            1,
            recent / 20 + Math.max(-0.15, Math.min(0.15, trend / 20))
          )
        );
        const blend = 0.22;
        const score = Math.max(
          0,
          Math.min(1, prediction.score * (1 - blend) + historicalSignal * blend)
        );
        return {
          ...prediction,
          score,
          expectedPoints: Math.max(
            0,
            Math.round((score * 20 + (prediction.features.media ?? 0) * 0.7) * 10) / 10
          ),
          history: {
            samples: profile.labeledSamples,
            averagePoints: profile.averagePoints,
            recentAveragePoints: profile.recentAveragePoints,
            formTrend: profile.formTrend,
            blend
          }
        };
      }
    }
  } catch (error) {
    console.error(`[brain-history] prediction history skipped: ${error.message}`);
  }
  return prediction;
};

BrainV27.prototype.status = function statusWithHistory() {
  return {
    ...originalStatus.call(this),
    history: history.summary(),
    historyVersion: HISTORY_VERSION,
    reasoning: 'history-aware'
  };
};

export { history, HISTORY_VERSION };
