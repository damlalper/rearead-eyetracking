/**
 * ReaRead Metrics Collector
 * Collects performance metrics and user feedback for evaluation
 */

class MetricsCollector {
  constructor() {
    this.metrics = {
      latency: {
        gazeCapture: [],
        smoothing: [],
        websocket: [],
        analysis: [],
        highlight: [],
        total: []
      },
      difficultyDetection: {
        truePositives: 0,
        falsePositives: 0,
        trueNegatives: 0,
        falseNegatives: 0,
        detections: []
      },
      dwellTimes: {
        easy: [],
        medium: [],
        hard: []
      },
      llmPerformance: {
        summarize: [],
        audio: [],
        simplify: []
      },
      userFeedback: []
    };

    this.startTime = null;
    this.checkpoints = {};
  }

  /**
   * Start latency measurement
   */
  startLatencyMeasurement(label) {
    this.startTime = performance.now();
    this.checkpoints = {};
    this.checkpoints['start'] = this.startTime;
    console.log(`[METRICS] Started: ${label}`);
  }

  /**
   * Add checkpoint for latency measurement
   */
  addCheckpoint(name) {
    if (!this.startTime) return;
    this.checkpoints[name] = performance.now();
  }

  /**
   * End latency measurement and calculate breakdown
   */
  endLatencyMeasurement() {
    if (!this.startTime) return null;

    const endTime = performance.now();
    const total = endTime - this.startTime;

    const breakdown = {
      total: total.toFixed(2),
      checkpoints: {}
    };

    const keys = Object.keys(this.checkpoints);
    for (let i = 1; i < keys.length; i++) {
      const prevKey = keys[i - 1];
      const currKey = keys[i];
      breakdown.checkpoints[currKey] = (this.checkpoints[currKey] - this.checkpoints[prevKey]).toFixed(2);
    }

    this.metrics.latency.total.push(parseFloat(total.toFixed(2)));

    console.log('[METRICS] Latency:', breakdown);
    this.startTime = null;
    return breakdown;
  }

  /**
   * Record difficulty detection result
   */
  recordDifficultyDetection({ systemPrediction, userFeedback, difficultyRatio, paragraphKey }) {
    const detection = {
      timestamp: Date.now(),
      systemPrediction, // 'difficult' or 'normal'
      userFeedback, // 'difficult' or 'normal'
      difficultyRatio,
      paragraphKey
    };

    this.metrics.difficultyDetection.detections.push(detection);

    // Update confusion matrix
    if (systemPrediction === 'difficult' && userFeedback === 'difficult') {
      this.metrics.difficultyDetection.truePositives++;
    } else if (systemPrediction === 'difficult' && userFeedback === 'normal') {
      this.metrics.difficultyDetection.falsePositives++;
    } else if (systemPrediction === 'normal' && userFeedback === 'difficult') {
      this.metrics.difficultyDetection.falseNegatives++;
    } else if (systemPrediction === 'normal' && userFeedback === 'normal') {
      this.metrics.difficultyDetection.trueNegatives++;
    }

    console.log('[METRICS] Detection recorded:', detection);
  }

  /**
   * Record dwell time with difficulty level
   */
  recordDwellTime({ dwellTime, expectedTime, difficultyLevel, paragraphKey }) {
    const record = {
      timestamp: Date.now(),
      dwellTime,
      expectedTime,
      ratio: dwellTime / expectedTime,
      paragraphKey
    };

    if (difficultyLevel === 'easy') {
      this.metrics.dwellTimes.easy.push(record);
    } else if (difficultyLevel === 'medium') {
      this.metrics.dwellTimes.medium.push(record);
    } else if (difficultyLevel === 'hard') {
      this.metrics.dwellTimes.hard.push(record);
    }

    console.log('[METRICS] Dwell time recorded:', record);
  }

  /**
   * Record LLM API performance
   */
  recordLLMPerformance({ mode, responseTime, success }) {
    const record = {
      timestamp: Date.now(),
      mode,
      responseTime,
      success
    };

    if (mode === 'summary') {
      this.metrics.llmPerformance.summarize.push(record);
    } else if (mode === 'audio') {
      this.metrics.llmPerformance.audio.push(record);
    } else if (mode === 'simplify') {
      this.metrics.llmPerformance.simplify.push(record);
    }

    console.log('[METRICS] LLM performance recorded:', record);
  }

  /**
   * Record user feedback
   */
  recordUserFeedback({ question, rating, comment }) {
    this.metrics.userFeedback.push({
      timestamp: Date.now(),
      question,
      rating, // 1-5 Likert scale
      comment
    });
  }

  /**
   * Calculate precision, recall, F1-score
   */
  getPerformanceMetrics() {
    const { truePositives, falsePositives, trueNegatives, falseNegatives } = this.metrics.difficultyDetection;

    const precision = truePositives + falsePositives === 0
      ? 0
      : truePositives / (truePositives + falsePositives);

    const recall = truePositives + falseNegatives === 0
      ? 0
      : truePositives / (truePositives + falseNegatives);

    const f1Score = precision + recall === 0
      ? 0
      : 2 * (precision * recall) / (precision + recall);

    const accuracy = truePositives + trueNegatives + falsePositives + falseNegatives === 0
      ? 0
      : (truePositives + trueNegatives) / (truePositives + trueNegatives + falsePositives + falseNegatives);

    return {
      precision: (precision * 100).toFixed(2) + '%',
      recall: (recall * 100).toFixed(2) + '%',
      f1Score: (f1Score * 100).toFixed(2) + '%',
      accuracy: (accuracy * 100).toFixed(2) + '%',
      confusionMatrix: {
        truePositives,
        falsePositives,
        trueNegatives,
        falseNegatives
      }
    };
  }

  /**
   * Get average latency breakdown
   */
  getAverageLatency() {
    const avg = arr => arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;

    return {
      total: avg(this.metrics.latency.total).toFixed(2) + 'ms',
      samples: this.metrics.latency.total.length
    };
  }

  /**
   * Get dwell time statistics
   */
  getDwellTimeStats() {
    const getStats = (records) => {
      if (records.length === 0) return { avg: 0, min: 0, max: 0, count: 0 };

      const dwellTimes = records.map(r => r.dwellTime);
      const ratios = records.map(r => r.ratio);

      return {
        avgDwellTime: (dwellTimes.reduce((a, b) => a + b, 0) / dwellTimes.length / 1000).toFixed(2) + 's',
        avgRatio: (ratios.reduce((a, b) => a + b, 0) / ratios.length).toFixed(2),
        count: records.length
      };
    };

    return {
      easy: getStats(this.metrics.dwellTimes.easy),
      medium: getStats(this.metrics.dwellTimes.medium),
      hard: getStats(this.metrics.dwellTimes.hard)
    };
  }

  /**
   * Get LLM performance stats
   */
  getLLMStats() {
    const getStats = (records) => {
      if (records.length === 0) return { avg: 0, min: 0, max: 0, successRate: 0 };

      const times = records.map(r => r.responseTime);
      const successful = records.filter(r => r.success).length;

      return {
        avgTime: (times.reduce((a, b) => a + b, 0) / times.length / 1000).toFixed(2) + 's',
        minTime: (Math.min(...times) / 1000).toFixed(2) + 's',
        maxTime: (Math.max(...times) / 1000).toFixed(2) + 's',
        successRate: ((successful / records.length) * 100).toFixed(1) + '%',
        count: records.length
      };
    };

    return {
      summarize: getStats(this.metrics.llmPerformance.summarize),
      audio: getStats(this.metrics.llmPerformance.audio),
      simplify: getStats(this.metrics.llmPerformance.simplify)
    };
  }

  /**
   * Export all metrics as JSON
   */
  exportMetrics() {
    const exportData = {
      timestamp: new Date().toISOString(),
      performance: this.getPerformanceMetrics(),
      latency: this.getAverageLatency(),
      dwellTime: this.getDwellTimeStats(),
      llm: this.getLLMStats(),
      rawData: this.metrics
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rearead-metrics-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    console.log('[METRICS] Exported:', exportData);
    return exportData;
  }

  /**
   * Print summary to console
   */
  printSummary() {
    console.log('\n=== ReaRead Metrics Summary ===\n');
    console.log('Performance Metrics:', this.getPerformanceMetrics());
    console.log('Latency:', this.getAverageLatency());
    console.log('Dwell Time:', this.getDwellTimeStats());
    console.log('LLM Performance:', this.getLLMStats());
    console.log('\n===============================\n');
  }
}

// Global instance
window.reareadMetrics = new MetricsCollector();

export { MetricsCollector };
