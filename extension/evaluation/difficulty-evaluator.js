// ============================================================================
// Difficulty Detection Evaluator
// ============================================================================
// This module tracks difficulty detection accuracy and calculates F1-score
// Author: ReaRead Team
// Purpose: Evaluate system performance with user feedback

class DifficultyEvaluator {
  constructor() {
    this.metrics = {
      truePositives: 0,
      falsePositives: 0,
      falseNegatives: 0,
      trueNegatives: 0
    };

    this.loadMetrics();
  }

  /**
   * Load metrics from chrome storage
   */
  async loadMetrics() {
    try {
      const result = await chrome.storage.local.get(['difficultyMetrics']);
      if (result.difficultyMetrics) {
        this.metrics = result.difficultyMetrics;
      }
    } catch (error) {
      console.error('[EVALUATOR] Failed to load metrics:', error);
    }
  }

  /**
   * Save metrics to chrome storage
   */
  async saveMetrics() {
    try {
      await chrome.storage.local.set({ difficultyMetrics: this.metrics });
    } catch (error) {
      console.error('[EVALUATOR] Failed to save metrics:', error);
    }
  }

  /**
   * Record a difficulty detection result
   * @param {boolean} systemDetected - Did system detect difficulty?
   * @param {boolean} userConfirmed - Did user confirm difficulty?
   */
  async record(systemDetected, userConfirmed) {
    if (systemDetected && userConfirmed) {
      this.metrics.truePositives++;
    } else if (systemDetected && !userConfirmed) {
      this.metrics.falsePositives++;
    } else if (!systemDetected && userConfirmed) {
      this.metrics.falseNegatives++;
    } else {
      this.metrics.trueNegatives++;
    }

    await this.saveMetrics();

    console.log('[EVALUATOR] Metrics updated:', this.getMetrics());
  }

  /**
   * Calculate precision
   */
  getPrecision() {
    const { truePositives, falsePositives } = this.metrics;
    const total = truePositives + falsePositives;
    return total === 0 ? 0 : truePositives / total;
  }

  /**
   * Calculate recall
   */
  getRecall() {
    const { truePositives, falseNegatives } = this.metrics;
    const total = truePositives + falseNegatives;
    return total === 0 ? 0 : truePositives / total;
  }

  /**
   * Calculate F1-score
   */
  getF1Score() {
    const precision = this.getPrecision();
    const recall = this.getRecall();

    if (precision + recall === 0) return 0;

    return 2 * (precision * recall) / (precision + recall);
  }

  /**
   * Get all metrics
   */
  getMetrics() {
    const precision = this.getPrecision();
    const recall = this.getRecall();
    const f1 = this.getF1Score();

    const total =
      this.metrics.truePositives +
      this.metrics.falsePositives +
      this.metrics.falseNegatives +
      this.metrics.trueNegatives;

    return {
      precision: (precision * 100).toFixed(1) + '%',
      recall: (recall * 100).toFixed(1) + '%',
      f1Score: (f1 * 100).toFixed(1) + '%',
      accuracy: (((this.metrics.truePositives + this.metrics.trueNegatives) / total) * 100).toFixed(1) + '%',
      totalSamples: total,
      confusionMatrix: this.metrics
    };
  }

  /**
   * Reset all metrics
   */
  async reset() {
    this.metrics = {
      truePositives: 0,
      falsePositives: 0,
      falseNegatives: 0,
      trueNegatives: 0
    };
    await this.saveMetrics();
  }
}

// Export for use in content script
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DifficultyEvaluator;
}
