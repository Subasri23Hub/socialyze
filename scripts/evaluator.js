/**
 * AI Social Media Campaign Generator — JS Evaluator Utility
 * ===========================================================
 * Implements client-side / Node.js classification metrics
 * (accuracy, precision, recall, F1) and a simple BLEU-1
 * approximation for generated text quality checks.
 *
 * Primary evaluation is done via evaluation/evaluate.py.
 * This module is a lightweight JS complement.
 *
 * Usage (Node.js):
 *   const Evaluator = require('./scripts/evaluator');
 *   const acc = Evaluator.accuracy([1,0,1,1], [1,0,0,1]);
 */

class Evaluator {

  /**
   * Proportion of matching elements between two equal-length arrays.
   * @param {Array} trueLabels
   * @param {Array} predictedLabels
   * @returns {number} 0–1
   */
  static accuracy(trueLabels, predictedLabels) {
    this._validateArrays(trueLabels, predictedLabels);
    const matches = trueLabels.filter((v, i) => v === predictedLabels[i]).length;
    return matches / trueLabels.length;
  }

  /**
   * Binary precision: TP / (TP + FP).
   * @param {Array<0|1>} trueLabels
   * @param {Array<0|1>} predictedLabels
   * @returns {number} 0–1
   */
  static precision(trueLabels, predictedLabels) {
    this._validateArrays(trueLabels, predictedLabels);
    let tp = 0, fp = 0;
    trueLabels.forEach((t, i) => {
      if (predictedLabels[i] === 1) {
        t === 1 ? tp++ : fp++;
      }
    });
    const p = tp + fp === 0 ? 0 : tp / (tp + fp);
    return p;
  }

  /**
   * Binary recall: TP / (TP + FN).
   * @param {Array<0|1>} trueLabels
   * @param {Array<0|1>} predictedLabels
   * @returns {number} 0–1
   */
  static recall(trueLabels, predictedLabels) {
    this._validateArrays(trueLabels, predictedLabels);
    let tp = 0, fn = 0;
    trueLabels.forEach((t, i) => {
      if (t === 1) {
        predictedLabels[i] === 1 ? tp++ : fn++;
      }
    });
    return tp + fn === 0 ? 0 : tp / (tp + fn);
  }

  /**
   * Harmonic mean of precision and recall.
   * @param {Array<0|1>} trueLabels
   * @param {Array<0|1>} predictedLabels
   * @returns {number} 0–1
   */
  static f1Score(trueLabels, predictedLabels) {
    const p = this.precision(trueLabels, predictedLabels);
    const r = this.recall(trueLabels, predictedLabels);
    return (p + r === 0) ? 0 : 2 * p * r / (p + r);
  }

  /**
   * Simplified BLEU-1: unigram precision of hypothesis against references.
   * @param {string[]} references  - Reference sentences (strings)
   * @param {string}   hypothesis  - Generated sentence (string)
   * @returns {number} 0–1
   */
  static bleuScore(references, hypothesis) {
    if (!hypothesis || !references.length) return 0;

    const tokenize  = (s) => s.toLowerCase().split(/\s+/).filter(Boolean);
    const hypTokens = tokenize(hypothesis);
    if (!hypTokens.length) return 0;

    // Build clipped count of reference unigrams
    const refCounts = {};
    references.forEach(ref => {
      tokenize(ref).forEach(t => {
        refCounts[t] = (refCounts[t] || 0) + 1;
      });
    });

    let overlap = 0;
    const hypCounts = {};
    hypTokens.forEach(t => { hypCounts[t] = (hypCounts[t] || 0) + 1; });
    Object.entries(hypCounts).forEach(([t, c]) => {
      if (refCounts[t]) overlap += Math.min(c, refCounts[t]);
    });

    return overlap / hypTokens.length;
  }

  /**
   * Quick quality scan of a generated campaign content object.
   * Returns heuristic scores suitable for display in a UI dashboard.
   * @param {Object} generatedContent
   * @returns {Object}
   */
  static evaluateContentQuality(generatedContent) {
    if (!generatedContent || typeof generatedContent !== "object") {
      return { error: "Invalid content object" };
    }

    const caption   = generatedContent.caption   || "";
    const hashtags  = generatedContent.hashtags  || [];
    const cta       = generatedContent.cta        || "";

    const wordCount     = caption.split(/\s+/).filter(Boolean).length;
    const hashtagCount  = Array.isArray(hashtags) ? hashtags.length : hashtags.split(" ").filter(Boolean).length;
    const hasQuestion   = /\?/.test(caption);
    const hasCta        = cta.length > 0;

    const readability   = Math.min(1, wordCount / 50);          // ideal ~50 words
    const engagement    = (hasQuestion ? 0.3 : 0) + (hasCta ? 0.4 : 0) + Math.min(0.3, hashtagCount / 10);
    const hashtagScore  = Math.min(1, hashtagCount / 8);        // ideal ~8 tags
    const overall       = (readability + engagement + hashtagScore) / 3;

    const recommendations = [];
    if (!hasCta)          recommendations.push("Add a clear call-to-action.");
    if (hashtagCount < 3) recommendations.push("Add at least 3 relevant hashtags.");
    if (!hasQuestion)     recommendations.push("Consider adding a question to boost engagement.");
    if (wordCount < 10)   recommendations.push("Caption is very short — expand for better context.");

    return {
      readability:          { score: parseFloat(readability.toFixed(2)) },
      engagementPotential:  { score: parseFloat(engagement.toFixed(2)) },
      hashtagEffectiveness: { score: parseFloat(hashtagScore.toFixed(2)) },
      overallScore:         parseFloat(overall.toFixed(2)),
      recommendations,
    };
  }

  // ── Private helpers ──────────────────────────────────────────────

  static _validateArrays(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b)) throw new TypeError("Both arguments must be arrays.");
    if (a.length !== b.length) throw new RangeError("Arrays must have the same length.");
  }
}

module.exports = Evaluator;
